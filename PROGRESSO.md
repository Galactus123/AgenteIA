# PROGRESSO — SaúdeSync

**Auditoria de estado do projeto**

| Item | Valor |
|---|---|
| Data da auditoria | 30/09/2026 |
| Última atualização | 01/10/2026 |
| Documento de requisitos | `PRD-SaudeSync.md` v1.1 |
| Branch / commit base | `main` @ `9ee6520` — *fix(ui): ajustar design system e acessibilidade de cores no modo claro* (27/09/2026) |
| Commits totais | 72 (primeiro: `7279797` "iniciar", 15/08/2026) |
| Código | `src/` — 146 arquivos, ~14.000 linhas (`.ts`/`.tsx`) |
| Árvore de trabalho | alterações não commitadas da migração SQLite → Supabase; `AgenteIA/` (cópia integral do working tree) e `data/**` ficam fora do `tsconfig` e do `eslint` |
| Stack | Next.js 16.2.12 (App Router + `proxy.ts`), React 19.2.4, Supabase (Postgres + Auth) — **persistência única** (o `node:sqlite` em runtime foi removido; `data/saudesync.db` só é lido por `scripts/setup-supabase.mjs`), Vitest 5, Vercel |

---

## 0. Resumo executivo

1. **A maior parte da UI e do "ciclo do agente" foi construída.** Landing, login, dashboard, cadastros, chat interno, assinatura, 32 rotas de API e um agente LLM com 7 tools (especialidade → horário → agendar → remarcar → cancelar → transferir) existem e compilam.
2. ~~**O projeto está dividido em dois bancos de dados que não conversam.**~~ **RESOLVIDO (01/10/2026):** `src/lib/db.ts` e `src/lib/multi-tenant.ts` foram removidos e todos os serviços, rotas, server components, o agente e a LGPD passaram a usar `supabaseAdmin` de forma assíncrona. Persistência única: Supabase.
3. **As migrações em `supabase/migrations/` foram escritas e parcialmente aplicadas, mas não são a fonte de verdade executável:** falta a migração `...000001` (o schema base está em `supabase-migration.sql`, na raiz), e a migração `...000005` corrompeu o schema `auth.users` ao fazer `INSERT` direto — origem confirmada do incidente de login que estava em depuração quando paramos.
4. **O MVP não está pronto para produção:** lembretes 24h/2h dependem de um `setInterval` (morre em serverless, não há `vercel.json`/cron), não há fila de reenvio em falha da API de WhatsApp, não há trava de conflito de horário, e a transferência para humano não interrompe a IA.
5. **Validação atual (01/10/2026):** `tsc` ✅ · `next build` ✅ · `vitest` ✅ (42 testes) · `eslint` ✅ (**0 erros / 0 warnings** — era 36/27).

---

## 0.1 Estado da migração SQLite → Supabase (01/10/2026)

| Etapa | Estado |
|---|---|
| Código convertido para `supabaseAdmin` (async) | ✅ serviços, auth, lgpd, agente, rotas API, server components, `instrumentation` |
| `src/lib/db.ts` / `src/lib/multi-tenant.ts` | ✅ removidos |
| `supabase/migrations/20260930000006_professionals_unification.sql` | ✅ **aplicada** (01/10/2026) — FKs `professionals→specialties` e `appointments→professionals` confirmadas via API |
| `supabase/migrations/20260930000007_appointments_clinic_fk.sql` | ⏳ **falta aplicar** — `appointments→clinics` (exigida pelo `VIEW_SELECT` de `appointments.ts`/`reminders.ts`) |
| `scripts/setup-supabase.mjs` (dados: SQLite → Supabase) | ✅ criado; dry-run validado; **⏳ `--apply` pendente** (rodar após a 007) |
| `medicos/page.tsx` grava `schedule` estruturado | ✅ `{weekday, start_time, end_time}[]` |
| Lint (`eslint`) | ✅ 0 erros / 0 warnings |

**Bloqueio conhecido:** a migração `007` ainda não foi aplicada. A `006` criou as FKs de
`professionals.specialty_id`, `appointments.professional_id` e `notifications.professional_id`,
mas **não** `appointments.clinic_id → clinics` — e é justamente a que `appointments.ts` e
`reminders.ts` usam (`VIEW_SELECT` com `clinics(name, address)`). Sem ela o PostgREST devolve
`PGRST200` e **as páginas de consultas/dashboard/lembretes quebram**. O script de dados faz esse
preflight e aborta com instruções.

---

## 1. Auditoria: o que foi implementado vs. o que o PRD exige

**Legenda:** ✅ implementado · 🟡 implementado parcialmente / com ressalva crítica · ❌ não implementado

### 1.1 Ciclo completo do MVP (conversa → especialidade → agendamento → confirmação → lembretes → remarcação/cancelamento)

| # | Requisito do PRD | Status | Onde está | Ressalva |
|---|---|---|---|---|
| 1 | Agente de IA conversando pelo WhatsApp | 🟡 | `src/app/api/webhooks/komunika/route.ts`, `src/lib/agent/agent.ts`, `src/lib/services/komunika.ts` | Webhook com HMAC, filtro de eventos e `waitUntil` ok. **Sem fila/DLQ**: falha de envio só gera `console.error` (`route.ts:137-141`) e o `catch` externo devolve `200` mesmo em erro fatal (`route.ts:100-103`), então a KOMUNIKA **não** fará retry. |
| 2 | Entendimento do motivo / sugestão de especialidade | ✅ | `src/lib/agent/prompts.ts`, tool `list_specialties` (`tools.ts:9-14`) | LLM configurável (`OPENAI_BASE_URL`/`OPENAI_MODEL`). Sanitização anti prompt-injection em `agent/security.ts` (testada). |
| 3 | Consulta de disponibilidade e agendamento automático | ✅ | tools `get_availability`/`book_appointment` (`tools.ts:18-50`), `services/appointments.ts` | Revalida slot antes de gravar (`tools.ts:123-128,202`), mas a gravação é um INSERT cego — **sem UNIQUE/lock** no Postgres nem no SQLite (ver 1.6). |
| 4 | Confirmação enviada ao paciente | ✅ | retorno de `book_appointment` → mensagem do bot (`agent.ts:144-148`) | Inclui médico, especialidade, data/hora, clínica e preço. |
| 5 | Lembretes automáticos 24h e 2h | 🟡 | `src/lib/services/reminders.ts:67-80`, `reminder-scheduler.ts`, `instrumentation.ts:8-9`, `POST /api/reminders/run` | Lógica de janela (23,5–24,5h / 1,5–2,5h) correta e idempotente por `SELECT` prévio. **Porém:** dispara por `setInterval(60s)` dentro de `instrumentation.ts` — em serverless o intervalo não sobrevive; **não existe `vercel.json` nem cron** para chamar `/api/reminders/run`. Idempotência é só aplicacional (sem `UNIQUE(appointment_id, type)`). |
| 6 | Remarcação automática | ✅ | tool `reschedule_appointment` + `appointments.ts` (`MAX_RESCHEDULES=1`) | Janela de 4h e limite de 1 remarcação conferidos. |
| 7 | Cancelamento automático + liberação do horário | ✅ | tool `cancel_appointment` + `appointments.ts` (`CANCEL_WINDOW_HOURS=4`) | Cancelamento não tem confirmação em duas etapas no código (depende do prompt/LLM). |
| 8 | Transferência para atendente humano | 🟡 | tool `transfer_to_human` (`tools.ts:280-285`), `agent.ts:130-134`, aviso em `webhooks/komunika/route.ts:144-159` | **A IA não para.** `conversation.status = "transferred"` é gravada, mas `handlePatientMessage` nunca lê esse status — a próxima mensagem continua sendo processada pelo LLM, e após a tool o loop faz `continue` (`agent.ts:141`) e pode gerar mais uma resposta junto com o aviso. Não há notificação estruturada da recepção (só o texto no WhatsApp). |
| 9 | Tratamento de erros e concorrência | 🟡/❌ | `tools.ts:136-145` (erros viram texto para o LLM), `slotExists` | **Horário disputado não é resolvido:** nenhuma `UNIQUE` em `appointments(starts_at, doctor_id)` (nem no SQLite `db.ts:118-136`, nem no Postgres) → TOCTOU entre "verificar" e "inserir". **"IA sem certeza":** parcial, via prompt/fallback (`agent.ts:180-195`). **Falha de API WhatsApp com fila: ❌ não existe.** |

### 1.2 Funcionalidades principais do PRD (itens 1–9)

| Item do PRD | Status | Observação |
|---|---|---|
| 1. Entendimento inteligente do motivo | ✅ | |
| 2. Sugestão automática da especialidade | ✅ | |
| 3. Agendamento automático | ✅ | |
| 4. Confirmação da consulta | ✅ | Localização da clínica incluída; "orientações de preparo" não existe no modelo. |
| 5. Lembretes automáticos | 🟡 | Ver 1.1 #5 — código ok, gatilho em produção ausente. |
| 6. Remarcação automática | ✅ | |
| 7. Cancelamento automático | ✅ | |
| 8. Transferência para humano | 🟡 | Ver 1.1 #8. |
| 9. Tratamento de erros/concorrência | 🟡/❌ | Ver 1.1 #9. |

### 1.3 Dashboard da clínica

| Exigência do PRD | Status | Onde |
|---|---|---|
| Consultas marcadas / canceladas / remarcadas | ✅ | `src/lib/services/stats.ts:40-42` |
| Agenda diária | ✅ | `stats.ts:53-69` |
| Médicos disponíveis | ✅ | `stats.ts:95-108` |
| Volume de atendimentos da IA | ✅ | `botMessages` (`stats.ts:44`) — mensagens do bot, não consultas criadas pela IA |
| Taxa de conversão de conversas em consultas | 🟡 | Calculada (`stats.ts:49-51`) mas **não exibida** na página |
| — | ⚠️ | "Consultas Hoje" na KPI usa `status='scheduled'` **sem filtro de data** (`stats.ts:40`); "Solicitações" lista só as consultas de hoje (`stats.ts:88-93`), não existe estado "pedido pendente" no modelo; "Total de pacientes" é `COUNT(DISTINCT patient_name)` sobre `appointments` (`stats.ts:46`), ignorando a tabela `patients`. |
| — | ⚠️ | ~~Todo o dashboard lê SQLite (efêmero em Vercel).~~ **Corrigido em 01/10/2026:** `getStats()` é assíncrono sobre o Supabase. **Pendência:** depende das FKs da migração `006` (embeddings `specialties`/`professionals`/`clinics`) — sem ela o `VIEW_SELECT` devolve `PGRST200`. |

Páginas: `src/app/(app)/dashboard`, `consultas`, `pacientes`, `medicos`, `especialidades`, `clinica`, `chat`, `perfil`, `configuracoes/assinatura` — todas existem com loading/error states.

### 1.4 Cadastros

| Cadastro | PRD | Status | Backend real | Problema |
|---|---|---|---|---|
| Clínica (nome, endereço, telefone, WhatsApp, horário, localização, redes sociais) | ✅ | `GET/POST /api/clinica` → **SQLite** `clinics` | OK em dev; efêmero em Vercel |
| Médicos (nome, especialidade, horários, dias, duração, valor, status) | 🟡 | Página `/medicos` fala **direto com Supabase** (`page.tsx:4,64,77,168,201`) — tabela `professionals` | **Quase certamente quebrado**: usa `src/lib/supabase.ts` (client anônimo, storage em `localStorage`), mas o login grava sessão em *cookies* (`@supabase/ssr`) → sem sessão no client → RLS `tenant_select` (migração 005) devolve **vazio** e bloqueia INSERT/UPDATE/DELETE. Além disso, mesmo que funcionasse, o agente lê a tabela `doctors` do **SQLite** — médico cadastrado em `/medicos` **não fica agendável pela IA**. |
| Especialidades (nome, descrição, médicos relacionados) | 🟡 | `GET/POST /api/especialidades` → **SQLite** | `/medicos` lê `specialties` do **Supabase** → dropdown divergente. Sem vínculo "médicos relacionados" no modelo de UI. |
| Pacientes | 🟡 | `GET/POST /api/pacientes` → **Supabase** `patients` | `POST` não envia `clinic_id` e a coluna é `NOT NULL` **sem default** (`migração ...000003`, linhas 72-86) → insert retorna erro. Pacientes criados aqui **não aparecem** para o agente (SQLite). |
| Perfil / senha / e-mail | ✅ | `/api/auth/{me,email,password}` → Supabase Auth | |

### 1.5 Regras de negócio (seção "Regras de Negócio" do PRD)

| Regra | Status | Referência |
|---|---|---|
| Agendamento no mesmo dia: só dentro do horário da clínica e até 2h antes | 🟡 | `getAvailableSlots` aplica `minStart = now + 120min` (`appointments.ts:148,168-170`), mas **não filtra pelo horário de funcionamento da clínica**; passo fixo de 30 min ignora `consultation_duration`. |
| Cancelamento gratuito até 4h antes (depois só humano) | 🟡 | Janela de 4h aplicada (`appointments.ts:265-267`); o "só humano depois das 4h" **não** existe como controle — a tool devolve erro ao LLM. |
| Remarcação gratuita até 4h, máx. 1 vez | ✅ | `appointments.ts:303-310,328` |
| No-show sem multa, horário liberado | 🟡 | Não há processo de liberação automática de horário de faltas. |
| Lembretes 24h/2h e retomada da IA ao responder | 🟡/❌ | Envio ok; **retomada da IA ao responder ao lembrete não é tratada de forma especial** (a mensagem entra no fluxo normal). |
| Nunca oferecer horários ocupados | 🟡 | Filtro por existência de `appointments` no SQLite, mas sem trava de unicidade → dois "sim" simultâneos passam. |
| Reserva só após confirmação do paciente | ✅ | Instruído no prompt e na descrição da tool. |

### 1.6 Segurança, LGPD e operação

| Exigência | Status | Onde / observação |
|---|---|---|
| Login seguro | 🟡 | Supabase Auth (e-mail/senha) + cookies `@supabase/ssr`; `requireAuth` em quase todas as rotas. **Restos do auth legado:** `src/lib/auth.ts` (HMAC em SQLite) ainda é usado por `chat/layout.tsx:5,8` → em produção `readSessionToken` retorna `null` e **`/chat` redireciona para `/dashboard`** (só passa em `NODE_ENV=development`). |
| Controle de acesso por perfil | 🟡 | `AdminRole`, `proxy.ts` (Next 16) protege rotas por cookie; papéis em `admin_profiles`/`clinic_members`; **signup não cria `clinic_members` nem clínica** → `get_user_clinic_ids()` = vazio → RLS devolve nada para usuário novo. |
| Criptografia dos dados | 🟡 | TLS/HSTS via `next.config.ts`; sem criptografia de repouso configurável pelo app. |
| Registro de atividades (audit log) | ❌ | Não existe tabela/fluxo de auditoria de ações. |
| Backup automático | ❌ | Fora do código, mas **não há nem documentação/verificação**; e o SQLite de produção vive em `/tmp`. |
| Conformidade LGPD | 🟡 | `src/lib/lgpd.ts` com políticas de retenção executadas no boot (`instrumentation.ts:12-21`) + páginas de privacidade/termos. |
| Segurança de webhook | ✅ | HMAC-SHA256 (`x-komunika-signature`), limite de 100KB, CORS restrito (`next.config.ts`), testes em `webhook.test.ts`. |
| — | ⚠️ | `scripts/fix-auth-user.mjs`, `recreate-auth-user.mjs`, `recreate-cascade.mjs` contêm **senha fixa no repositório** (`Saudesync2026!`) e `check-user.mjs` lê `.env`. `.env` em si **nunca foi versionado** (verificado no histórico). |

### 1.7 Escopo "pós-MVP" já implementado (atenção ao PRD)

O PRD coloca isto **fora** do MVP, mas já está no código — e consome manutenção:

| Item | Status no código | PRD diz |
|---|---|---|
| Integração KOMUNIKA | ✅ (webhook + envio + setup) | v2.0 |
| Pagamentos LOJOU (M-pesa/E-mola) | ✅ `api/webhooks/lojou/route.ts` (13,7 kB) + `lib/services/subscriptions.ts` | v1.5 / fora do MVP |
| Assinatura, planos, limites, pacote de excesso | ✅ `lib/plans.ts`, `services/plan-limits.ts`, 6 rotas `/api/subscription/*` | Modelo de negócio, mas cobrança online é pós-MVP |
| Multi-tenant | 🟡 schema/RLS sim; runtime `getDefaultClinicId()` (agora em `services/clinics.ts`) pega a 1ª clínica | v2.0 |
| KPIs/relatórios avançados | 🟡 só o dashboard básico | pós-MVP |
| Landing + 10 páginas de especialidade (`/agendamento-*`) + preços, termos, privacidade | ✅ | não previsto no PRD |

### 1.8 Auditoria das migrações (`supabase/migrations/`)

| Arquivo | Tamanho | Papel |
|---|---|---|
| *(falta)* `...000001_*.sql` | — | **Não existe.** O schema base (17 tabelas + seed "Clinica Vida" + RLS `USING(false)`) está em **`supabase-migration.sql` na raiz**, fora de `supabase/migrations/`. Um `supabase db push` limpo **não cria o schema inicial**. |
| `20260911000002_rls_fix.sql` | 15,8 kB | Adiciona `clinic_id` (com `DEFAULT 1`) em 8 tabelas, popula dados, índices, habilita RLS e cria policies `USING (false)` (bloqueio total de `anon`); documenta que o app ainda usava cookies HMAC + `service_role`. |
| `20260911000003_schema_definitivo.sql` | 28,3 kB | "v6": cria `patients`/`professionals`, migra dados PT→EN, cria `profiles`, `clinic_members`, `subscriptions`, `usage`, `units`, `medical_records`, `admin_profiles`, renomeia `*_legacy` e `doctors`→`doctors_legacy`. |
| `20260911000004_grant_permissions.sql` | 2,3 kB | Patch solto (sem cabeçalho de migration): `GRANT ALL ... TO service_role, authenticated, **anon**`. **Contradiz** o bloqueio de `anon` da 002 — RLS ainda mitiga, mas é ruído/perigoso. |
| `20260911000005_auth_rls.sql` | 12,8 kB | Habilita RLS em 21 tabelas, cria `get_user_clinic_ids()`, policies `tenant_*` por clínica, e — **FASE 5, linhas 229-324** — faz `INSERT` direto em `auth.users` para migrar admins. **Esta fase corrompeu o schema `auth.users`** (evidência: cabeçalhos de `scripts/diagnose-auth-schema.sql` e `scripts/fix-auth-schema.sql`: *"Causa: Migration 005 fez INSERT direto em auth.users com colunas que podem nao existir ou triggers quebrados"*). |
| `20260911000002_rls_fix.backup.sql` | 15,8 kB | Cópia de segurança (ignorada pelo git). |

**Problemas estruturais das migrações:**

1. **Sequência incompleta** — sem `000001`; dependência de um SQL solto na raiz.
2. **Ordem/Idempotência frágil** — `003` assume que `002` já rodou e renomeia tabelas; reaplicar gera erro ou recria `*_legacy`.
3. **`005` não é seguro para executar em banco vivo** (FASE 5) e **não remove** as policies `USING(false)` antigas — as policies novas somam por OR, o que funciona, mas deixa regras mortas para trás.
4. **`doctor_schedule` policies apontam para `doctors_legacy`** (`005:176-210`), enquanto a tabela de negócio do app é `doctors` (SQLite) — a política não corresponde a nenhuma tabela usada pela aplicação.
5. **Faltam constraints de negócio que o PRD exige:** `UNIQUE (doctor_id, starts_at)` em `appointments`; `UNIQUE (appointment_id, type)` em `reminders`; `UNIQUE`/índice em `conversations.phone`; índice em `appointments(starts_at)`.
6. **Estado real do banco não é verificável a partir do repositório** — não há log de aplicação, nem `supabase/config.toml`, nem script `migrate`. Os scripts em `scripts/` e `data/` (`audit_migration.js`, `check_supabase_tables.js`, `inspect_schemas.js`) são inspeção manual de 11/09.

### 1.9 ⚠️ Achado crítico: banco dividido (SQLite × Supabase) — **RESOLVIDO em 01/10/2026**

| Caminho de dados | Backend | Arquivos |
|---|---|---|
| ~~Agente IA, conversas, mensagens, lembretes, notificações, especialidades, clínica, assinatura/limites, stats, auth-antiga~~ | ~~**SQLite** (`node:sqlite`)~~ → **Supabase/Postgres** | `src/lib/services/*`, `src/lib/auth.ts`, `src/lib/lgpd.ts` (todos com `supabaseAdmin` async); `src/lib/db.ts` e `src/lib/multi-tenant.ts` **removidos** |
| `pacientes`, `consultas` (API), `professionals`/`specialties` (página `/medicos`), `auth` (Supabase Auth), `profiles`/`admin_profiles`/`clinic_members` | **Supabase/Postgres** | `src/lib/supabase.ts`, `src/utils/supabase/*`, `src/app/api/{pacientes,consultas,auth}/*`, `src/app/(app)/medicos/page.tsx` |

**O que foi corrigido:**

- ~~**Produção (Vercel):** SQLite em `/tmp`, efêmero.~~ → não há mais SQLite no runtime; a fonte é sempre o Supabase.
- ~~**Divisão de cadastros:** médico de `/medicos` não era oferecido pelo agente.~~ → agente, `/medicos` e `/especialidades` leem `professionals`/`specialties`.
- **Endpoint órfão (pendente):** `/api/consultas` não é chamado por nenhuma página; existem dois CRUDs paralelos (`/api/appointments` × `/api/consultas`) — ver Fase 1.5.
- **Novo usuário sem tenant (pendente):** `signup` cria `profiles` + `admin_profiles` mas **não** `clinic_members` nem clínica → qualquer leitura autenticada por RLS volta vazia — ver Fase 0.2.

> Dado histórico (SQLite `data/saudesync.db`, ainda necessário para a migração de dados):
> `admins(1), clinics(1), specialties(9), doctors(8), doctor_schedule(42), conversations(12), messages(138)`
> — as demais tabelas estão vazias.

### 1.10 Órfãos e dívida técnica observada

- **Componentes não importados:** `kpi-card`, `appointments-list`, `doctor-status-list`, `appointment-requests-card`, `subscription-panel`, `upgrade-modal`, `animated-table-rows`, `animated-entry`.
- **Rotas sem consumidor na UI:** `/api/appointments`, `/api/consultas`, `/api/stats`, `/api/conversations`, `/api/chat/history`, `/api/notifications/[id]`, `/api/especialidades/[id]`, `/api/pacientes/[id]`, `/api/subscription/{limits,usage}` (algumas são legítimas para uso externo/cron).
- **Debug remanescente:** `console.log` extensivo em `api/auth/login/route.ts:45-118` (rotulado `DEBUG LOGIN ERROR`) e logs por request em `webhooks/komunika/route.ts`.
- **Testes (42, todos verdes)** cobrem apenas: tokens/hash/cookie da **autenticação legada** (`auth.test.ts`), sanitização (`security.test.ts`) e HMAC/filtro de eventos (`webhook.test.ts`). **Zero testes** para: agente, tools, `appointments` (regras de 4h/1 remarcação), lembretes, RLS, multi-tenant.
- **README desatualizado:** ainda documenta `admin/admin123` e "o MVP usa `node:sqlite`" como se fosse definitivo.
- **`.github/workflows/ci.yml` usa Node 20**, enquanto `package.json` exige `>=22` e `.node-version` = 22 (local: v24.18.0). Com a remoção de `db.ts` o `node:sqlite` saiu de `src/`, então o **build** do CI deve passar; ainda assim o `engines` diverge e os `scripts/*.mjs` que usam `node:sqlite` (`setup-supabase.mjs`) exigem Node ≥ 22 — ver Fase 5.2.

---

## 2. Onde paramos

### 2.1 Estado do repositório

```
branch main (up to date com origin/main)
último commit: 9ee6520 (27/09/2026 22:50) fix(ui): ajustar design system e acessibilidade de cores no modo claro
working tree: limpa
não versionado: AgenteIA/  (cópia byte-a-byte do working tree, criada em 28/09/2026 13:37 — aparentemente backup/transferência)
PROGRESSO.md: inexistente até esta auditoria
```

Sequência dos últimos commits (27/09/2026), que delimita a tarefa em curso:

| Hora | Commit | Assunto |
|---|---|---|
| ~22:09–22:31 | `848e7dd` | **fix(auth)**: debug logging na rota de login + `scripts/` de diagnóstico e reparo do auth |
| 22:41 | `9ef575b` | fix(ui): suprimir erro de script tag do next-themes |
| 22:50 | `9ee6520` | fix(ui): cores do modo claro |

### 2.2 Tarefa em curso: **destravar a autenticação no Supabase Auth**

Este é o ponto exato onde paramos. Evidências:

1. **Causa raiz já identificada e documentada pelos próprios scripts:**
   `scripts/diagnose-auth-schema.sql:1-5` e `scripts/fix-auth-schema.sql:1-5` declaram explicitamente:
   > *"Causa: Migration 005 fez INSERT direto em auth.users com colunas que podem nao existir ou triggers quebrados"*
2. **Rota de login em modo instrumentado:** `src/app/api/auth/login/route.ts:45-118` — cinco checkpoints `DEBUG LOGIN ERROR: STEP 1..5`, `console.log` de e-mail, `user.id` e resultado completo da sessão. O comentário em `route.ts:48` registra a descoberta: *"`service_role` causa 'Database error querying schema'"* → o signIn foi trocado para o client anon + cookies.
3. **Caixa de ferramentas de reparo criada e não integrada** (todas de 27/09):
   - `scripts/diagnose-auth-schema.sql` — inspeciona colunas/triggers/constraints de `auth.users`;
   - `scripts/fix-auth-schema.sql` — **apaga** o usuário `galactusbank77@gmail.com` / `cd4ac28d-...` de `auth.users`;
   - `scripts/fix-auth-user.mjs`, `recreate-auth-user.mjs`, `recreate-cascade.mjs` — recriam o usuário (senha fixa `Saudesync2026!`) e **recriam em cascata** `admin_profiles` + `clinic_members` (a migração de cascata foi perdida);
   - `scripts/check-user.mjs` — confere `admin_profiles` e `clinic_members` dos UUIDs `f9264de1-...` (novo) e `cd4ac28d-...` (antigo).
4. **Nada disso foi commitado como solução** — foram adicionados no commit de depuração e o trabalho mudou de assunto para UI (20 minutos depois). Não há commit de "auth resolvido".

**Estado de validação do item:** **não validado de ponta a ponta.** Não há registro de um login bem-sucedido após o reparo; os `console.log` continuam no código (sinal de depuração ativa).

### 2.3 Tarefa concluída imediatamente antes (parêntese)

`9ee6520` — acessibilidade/contraste do modo claro em `src/app/globals.css` (+38/−39 linhas). Passada visual final, sem relação com o bloqueio de auth.

### 2.4 Estado de validação (reexecutado em 01/10/2026)

| Check | Comando | Resultado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ **0 erros** |
| Build | `npm run build` | ✅ **exit 0** — rotas geradas (API + páginas) + `ƒ Proxy (Middleware)` |
| Testes | `npm test` (vitest) | ✅ **42/42** em 3 arquivos |
| Lint | `npm run lint` (eslint) | ✅ **0 erros + 0 warnings** (era 36 + 27 em 30/09) |
| CI (`.github/workflows/ci.yml`) | lint → typecheck → test → build | ⚠️ **depende do Node** — `node:sqlite` saiu do runtime do app, mas `scripts/setup-supabase.mjs` e `scripts/check-user.mjs` usam Node ≥ 22 |
| Migrações | — | ❌ **006 ainda não aplicada** (ver 0.1) — as 002→005 estão no banco |
| E2E / smoke em produção | — | ❌ não realizado nesta auditoria |

**Como os 36 erros de lint foram zerados (01/10/2026):**

| Regra | Como foi resolvido |
|---|---|
| `react-hooks/set-state-in-effect` (20) | `useMounted()` novo (`src/lib/use-mounted.ts`) via `useSyncExternalStore` para o padrão "mounted"; chamadas `load()`/`fetchHistory()` dentro de `useEffect` envolvidas em IIFE assíncrona; media query do `login` e fechamento do menu móvel do `sidebar` reescritos (render-time adjustment / `useSyncExternalStore`) |
| `react-hooks/error-boundaries` (8) | `try/catch` de `src/app/(app)/layout.tsx` deixou de conter JSX — o `return` saiu para depois do bloco |
| `@typescript-eslint/no-require-imports` (8) | já zerados antes desta rodada |
| `@typescript-eslint/no-unused-vars` (27 → 0) | removidos `SkeletonCard`, `formatPrice`, `billingPeriod`, `PlanId`, `formatLimit`, `handleCheckout` + overlay de checkout órfão, `cmErr` e o binding `supabase` em `proxy.ts` |

### 2.5 O que permanece **não validado**

- Aplicação real das migrações 002→005 no banco de produção (sem log).
- Login → dashboard → CRUD → agendamento pela IA, de ponta a ponta, em ambiente com Supabase Auth ativo.
- Envio/recebimento real via KOMUNIKA (HMAC, eventos, numeração).
- Disparo dos lembretes fora de `npm run dev`.
- Comportamento do app em Vercel (SQLite em `/tmp`).

---

## 3. Fases e tarefas cruciais até a entrega final

> Ordem sugerida. "P0" = bloqueia a entrega; "P1" = degrada o MVP; "P2" = qualidade/escopo.

### Fase 0 — Destravar (P0) — *é onde paramos*

- [ ] **0.1** Confirmar/repairar `auth.users` e validar **um login real** de ponta a ponta (login → cookie → `/dashboard` → `GET /api/auth/me`).
- [ ] **0.2** `signup` passa a criar, na transação correta: usuário → `profiles` → `admin_profiles` → **`clinic_members` + `clinics`** (sem isso, RLS devolve vazio).
- [ ] **0.3** Remover os `console.log` de depuração de `api/auth/login/route.ts` e tratar `admin_profiles`/`clinic_members` ausentes como erro explícito (hoje viram fallback silencioso: `role: "admin"`).
- [ ] **0.4** Decidir o destino dos `scripts/*.mjs` de reparo: mover para `scripts/ops/`, **remover a senha fixa do repositório** e documentar o procedimento.
- [ ] **0.5** Corrigir o que motivou a migração de emergência: a FASE 5 da migração `005` não pode ser re-executada — extraí-la para um script idempotente e versionado.

### Fase 1 — Unificar a persistência (P0) — *questão estrutural nº 1*

- [x] **1.1** **Decisão de arquitetura** — **decidido: Supabase como banco único** (01/10/2026).
- [x] **1.2** Reescrever `src/lib/db.ts` + `src/lib/services/*` sobre `supabaseAdmin` — **feito**: `db.ts` e `multi-tenant.ts` removidos; serviços, auth, lgpd, agente, rotas API, server components e `instrumentation` convertidos para `supabaseAdmin` async.
- [x] **1.3** Eliminar a dependência de `/tmp` — **feito**: o runtime não abre mais `data/saudesync.db` (SQLite só é lido por `scripts/setup-supabase.mjs`).
- [x] **1.4** Definir **uma** fonte para médicos e especialidades — **feito**: tudo lê `professionals` / `specialties` no Supabase.
- [ ] **1.5** Remover um dos CRUDs duplicados: alinhar `/api/appointments` × `/api/consultas` (manter um; atualizar `/consultas`).
- [ ] **1.6** Criar migração **`20260911000001_schema_base.sql`** a partir de `supabase-migration.sql` (ou mover o arquivo para `supabase/migrations/`), para que `supabase db push` funcione do zero.
- [ ] **1.7** Corrigir o `POST /api/pacientes` (enviar `clinic_id` ou dar `DEFAULT` na coluna) e o `GET` por telefone (hoje devolve 404 genérico em erro de `single()`).
- [ ] **1.8** **Dados do SQLite → Supabase:** `20260930000006` ✅ aplicada; **aplicar `20260930000007_appointments_clinic_fk.sql`** e depois rodar `node scripts/setup-supabase.mjs --apply` (dry-run já validado: +5 especialidades, +8 profissionais, +1 admin, +9 conversas, +138 mensagens).

### Fase 2 — Auth, tenant e RLS (P0/P1)

- [ ] **2.1** Trocar `src/lib/supabase.ts` (client anônimo sem sessão) por `createBrowserClient` de `@supabase/ssr` em **`src/app/(app)/medicos/page.tsx`** — hoje a página quase certamente lê vazio e não consegue gravar por causa do RLS.
- [ ] **2.2** Aposentar o auth legado: `chat/layout.tsx:5,8` lê o cookie HMAC antigo → **`/chat` está inacessível em produção**. Migrar para `supabase.auth.getUser()` + checagem de papel.
- [ ] **2.3** Revisar `proxy.ts`: matcher não cobre `/configuracoes`, `/pacientes` está no matcher mas o redirect checa `/settings` e `/appointments` (rotas que não existem).
- [ ] **2.4** Definir quem usa `service_role` × `anon` × `authenticated`; remover o `GRANT ALL ... TO anon` da migração `004`.
- [ ] **2.5** Aplicar/verificar as migrações 002→005 **num banco limpo** e registrar o resultado (log anexado a este documento).
- [ ] **2.6** Remover as policies mortas `USING (false)` e corrigir as policies de `doctor_schedule` (apontam para `doctors_legacy`).

### Fase 3 — Confiabilidade do agente e regras de negócio (P0/P1)

- [ ] **3.1** **Lembretes em produção (P0):** criar `vercel.json` com cron apontando para `POST /api/reminders/run` (já pronto e protegido por `INTERNAL_API_TOKEN`), ou migrar para uma Edge/Supabase cron. Manter o `setInterval` apenas como fallback em dev.
- [ ] **3.2** **Idempotência dos lembretes:** `UNIQUE (appointment_id, type)` + `INSERT ... ON CONFLICT DO NOTHING`.
- [ ] **3.3** **Concorrência de horário (P0):** `UNIQUE (doctor_id, starts_at)` (ou lock transacional) + tratamento de erro amigável devolvendo "horário acabou de ser ocupado" e oferecendo o próximo.
- [ ] **3.4** **Fila de mensagens do WhatsApp (P0):** tabela `outbox` + reprocessamento; o webhook deve devolver `5xx` em erro fatal para que a KOMUNIKA reenvie (hoje devolve `200`).
- [ ] **3.5** **Transferência real (P0):** ler `conversation.status` no início de `handlePatientMessage` e **encerrar a participação da IA** (`transferred`/`WAITING_HUMAN_INTERVENTION`); não continuar o loop após `transfer_to_human`; notificar a recepção com o histórico.
- [ ] **3.6** Fechar as regras que faltam: horário de funcionamento no agendamento do mesmo dia; corte das 4h para remarcar/cancelar só via humano; liberação de horário em no-show; `consultation_duration` no lugar do passo fixo de 30 min.
- [ ] **3.7** Cancelamento/remarcação com confirmação explícita em duas etapas.

### Fase 4 — Dashboard e dados (P1)

- [ ] **4.1** Exibir `conversionRate` (já calculado) e corrigir "Consultas Hoje" (`stats.ts:40` sem filtro de data) e "Total de pacientes" (`stats.ts:46` deve ler a tabela de pacientes).
- [ ] **4.2** Introduzir o estado "pedido pendente" real (ou renomear o card — hoje ele só reexibe consultas de hoje).
- [ ] **4.3** Alimentar `pendingRequests`/`totalPatients` sem engolir erro silenciosamente (`safeCount`/`safeAll` viram `0` em falha de banco).
- [ ] **4.4** Definir destino dos componentes órfãos (8 arquivos) e das rotas sem consumidor.

### Fase 5 — Qualidade e CI (P0 para merge)

- [x] **5.1** Zerar os **36 erros** de ESLint (20 `set-state-in-effect`, 8 `error-boundaries`, 8 `no-require-imports`) — **feito em 01/10/2026** (`eslint` agora 0 erros / 0 warnings).
- [ ] **5.2** CI: trocar Node 20 → 22/24 (hoje o job de build quebraria por `node:sqlite`) e alinhar `README` ("Node 20.9+"), `.node-version` e `engines`.
- [ ] **5.3** Alçar cobertura: testes de regras de negócio (`appointments`: 4h/1 remarcação/2h), do agente (loop, transferência, quota) e do scheduler de lembretes. Hoje 42 testes cobrem apenas auth legada, sanitização e HMAC.
- [ ] **5.4** Ligar `test:coverage`/status check obrigatório no GitHub.

### Fase 6 — Segurança e operação (P0/P1)

- [ ] **6.1** Rotacionar as cinco chaves obrigatórias (ver aviso ao final) e verificar que **não** estão em nenhum ponto do histórico do git (`.env` nunca foi versionado — confirmado — mas `server.log` está versionado e deve ser revisado/removido).
- [ ] **6.2** Remover senha fixa dos `scripts/` e restringir `INTERNAL_API_TOKEN`.
- [ ] **6.3** Audit log de atividades (exigência do PRD, hoje inexistente).
- [ ] **6.4** Backup e restauração documentados + retenção LGPD verificada com dados reais.
- [ ] **6.5** Remover `db.ts.backup`, `supabase-migration.backup.sql`, `*.backup.sql` e a cópia não versionada `AgenteIA/` (ou versioná-la como artefato deliberado).
- [ ] **6.6** Rate limiting/anti-Abuse no webhook e nas rotas de auth; mascarar PII nos logs.

### Fase 7 — Go-live e aceite do MVP

- [ ] **7.1** Deploy limpo: banco novo → `000001`..`000005` → seed → smoke test.
- [ ] **7.2** Jornada E2E real: WhatsApp → IA agenda → confirmação → lembrete 24h → remarcação → cancelamento → transferência para humano.
- [ ] **7.3** Cron de lembretes comprovado em produção (log + mensagem entregue).
- [ ] **7.4** Teste de concorrência: dois agendamentos no mesmo slot → só um vence.
- [ ] **7.5** Revisão de acessibilidade/contraste (o commit `9ee6520` começou isso) + responsividade mobile.
- [ ] **7.6** Atualizar `README.md` (credenciais, setup com Supabase, arquitetura final) e consolidar este documento.

### Critérios de aceite do PRD que ainda estão abertos

| Critério | Bloqueio atual |
|---|---|
| Ciclo completo automatizado (conversa → consulta marcada) | Fases 1 + 3 |
| Lembretes reduzem faltas | Fase 3.1/3.2 (cron) |
| Remarcar/cancelar sem intervenção humana | Fase 3.5/3.7 |
| Transferência para humano | Fase 3.5 |
| Nunca oferecer horário ocupado | Fase 3.3 |
| Painel com métricas corretas | Fase 4 |
| Segurança/controle de acesso/LGPD | Fases 2 e 6 |

### Decisões pendentes (precisam do produto/cliente)

1. ~~**Banco único em Supabase ou SQLite** (Fase 1.1)~~ — **decidido: Supabase único** (01/10/2026).
2. KOMUNIKA está em produção com webhook apontando para este app, ou ainda é simulador (`KOMUNIKA_API_TOKEN` vazio)?
3. Os dados reais da clínica estão no Supabase, no SQLite, ou em ambos (duplicados)?
4. Escopo: manter assinatura/LOJOU/multi-tenant (já construídos) ou congelar até o MVP do PRD estar sólido?
5. Quem executa as migrações no ambiente de produção e qual é o estado real do banco hoje?

---

## Apêndice — Comandos de validação desta auditoria

```bash
npx tsc --noEmit                        # ✅ 0 erros
npm run build                           # ✅ exit 0
npm test                                # ✅ 42/42
npm run lint                            # ✅ 0 erros, 0 warnings
node scripts/setup-supabase.mjs         # dry-run do SQLite -> Supabase
node scripts/setup-supabase.mjs --apply # executa (rode depois da migração 006)
node -v                                 # v24.18.0 (local) / CI: 20  ← divergente de engines >=22
```

---

> ⚠️ LEMBRETE DE SEGURANCA: Nao se esqueca de realizar a rotatividade obrigatoria das chaves expostas no Git (OPENAI_API_KEY, KOMUNIKA_API_TOKEN, KOMUNIKA_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY e LOJOU_WEBHOOK_SECRET) diretamente nos paineis das plataformas e atualizar as variaveis no ambiente da Vercel.
