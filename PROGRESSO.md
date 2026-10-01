# PROGRESSO — SaúdeSync

**Auditoria de estado do projeto**

| Item | Valor |
|---|---|
| Data da auditoria | 30/09/2026 |
| Última atualização | 01/10/2026 (sessão 2 — Fase 0 + regressões da conversão) |
| Documento de requisitos | `PRD-SaudeSync.md` v1.1 |
| Branch / commit base | `main` @ `67d65f0` — *feat(db): migrar persistencia de SQLite para Supabase e zerar lint* (01/10/2026); **sessão 2 está inteira no working tree, não commitada** |
| Commits totais | 72 (primeiro: `7279797` "iniciar", 15/08/2026) |
| Código | `src/` — 146 arquivos, ~14.000 linhas (`.ts`/`.tsx`) |
| Árvore de trabalho | alterações não commitadas da Fase 0 + correções de `await` + migrações 008/009; `AgenteIA/` (cópia integral do working tree) e `data/**` ficam fora do `tsconfig` e do `eslint` |
| Stack | Next.js 16.2.12 (App Router + `proxy.ts`), React 19.2.4, Supabase (Postgres + Auth) — **persistência única** (o `node:sqlite` em runtime foi removido; `data/saudesync.db` só é lido por `scripts/setup-supabase.mjs`), Vitest 5, Vercel |

---

## 0. Resumo executivo

1. **A maior parte da UI e do "ciclo do agente" foi construída.** Landing, login, dashboard, cadastros, chat interno, assinatura, 32 rotas de API e um agente LLM com 7 tools (especialidade → horário → agendar → remarcar → cancelar → transferir) existem e compilam.
2. ~~**O projeto está dividido em dois bancos de dados que não conversam.**~~ **RESOLVIDO (01/10/2026):** `src/lib/db.ts` e `src/lib/multi-tenant.ts` foram removidos e todos os serviços, rotas, server components, o agente e a LGPD passaram a usar `supabaseAdmin` de forma assíncrona. Persistência única: Supabase.
3. **As migrações em `supabase/migrations/` avançaram, mas a fonte de verdade executável continua quebrada:** `006`, `007` **aplicadas** (FKs de embedding confirmadas por probe no PostgREST), `008` e `009` **escritas e ainda não aplicadas**; e **continua sem `...000001`** — o schema base (17 tabelas + seed) segue em `supabase-migration.sql`, na raiz. A `005` perdeu a FASE 5 (a que corrompeu `auth.users`), agora extraída para a `009` idempotente.
4. **O MVP não está pronto para produção:** lembretes 24h/2h dependem de um `setInterval` (morre em serverless, não há `vercel.json`/cron), não há fila de reenvio em falha da API de WhatsApp, não há trava de conflito de horário, e a transferência para humano não interrompe a IA.
5. **Validação atual (01/10/2026, sessão 2):** `tsc` ✅ · `next build` ✅ · `vitest` ✅ (38 testes — os 9 da autenticação legada saíram na Fase 2.2 e 5 de rota/proxy entraram na 2.3) · `eslint` ✅ **0 erros / 0 warnings com regras type-aware novas** (`await-thenable`, `no-floating-promises`, `no-misused-promises`) — estas regras pegaram e foi corrigido um bug de classe da conversão SQLite → Supabase (services viraram `async` e 15 chamadas ficaram sem `await`, serializando `Promise` como `{}`).

---

## 0.1 Estado da migração SQLite → Supabase (01/10/2026, sessão 2)

| Etapa | Estado |
|---|---|
| Código convertido para `supabaseAdmin` (async) | ✅ serviços, auth, lgpd, agente, rotas API, server components, `instrumentation` |
| `src/lib/db.ts` / `src/lib/multi-tenant.ts` | ✅ removidos |
| `supabase/migrations/20260930000006_professionals_unification.sql` | ✅ **aplicada** — FKs `professionals→specialties` e `appointments→professionals` confirmadas via probe |
| `supabase/migrations/20260930000007_appointments_clinic_fk.sql` | ✅ **aplicada** — probe `appointments→clinics` OK |
| `supabase/migrations/20260930000008_appointments_patient_fk.sql` | ✅ **aplicada (01/10/2026)** — probe `appointments→patients` OK (nesta fase a FK virou só integridade: nenhuma query do app embute `patients`) |
| `supabase/migrations/20260930000009_admins_auth_link.sql` | ✅ **aplicada (01/10/2026)** — FASE 5 da `005` extraída (não toca em `auth.users`); `admin_profiles` 1/1 vinculado ao GoTrue |
| `scripts/setup-supabase.mjs` (dados: SQLite → Supabase) | ✅ **`--apply` executado** — 161 inseridos / 5 atualizados; reexecução = 0 a inserir |
| `medicos/page.tsx` grava `schedule` estruturado | ✅ `{weekday, start_time, end_time}[]` |
| Promises sem `await` na conversão async | ✅ **15 ocorrências corrigidas** + regras de lint type-aware para não regredir |
| Lint (`eslint`) | ✅ 0 erros / 0 warnings (com `await-thenable`, `no-floating-promises`, `no-misused-promises` ativos) |

**Dado migrado (01/10/2026):** +5 especialidades, +8 profissionais, +1 admin,
+9 conversas, +138 mensagens — telefones fundidos 12→9 com normalização de dígitos.
As 4 diferenças de texto (`Clínica Vida` → `Clinica Vida`, acentos, `current_token_usage`)
foram mantidas como estão no Supabase (o contador é vivo).

**Bloqueio atual:** **nenhum bloqueio de banco** — sequência `000002`→`000009` completa no
Supabase e preflight do `setup-supabase.mjs` saindo com exit 0 (FKs de `006`/`007`/`008`
presentes). Resta da Fase 1 só a **1.6** (criar o `...000001_schema_base.sql` para um banco
novo sair do zero).

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
| — | ✅ | ~~Todo o dashboard lê SQLite (efêmero em Vercel).~~ **Corrigido em 01/10/2026:** `getStats()` é assíncrono sobre o Supabase; as FKs da migração `006` (embeddings `specialties`/`professionals`/`clinics`) já estão **aplicadas e confirmadas por probe**. |

Páginas: `src/app/(app)/dashboard`, `consultas`, `pacientes`, `medicos`, `especialidades`, `clinica`, `chat`, `perfil`, `configuracoes/assinatura` — todas existem com loading/error states.

### 1.4 Cadastros

| Cadastro | PRD | Status | Backend real | Problema |
|---|---|---|---|---|
| Clínica (nome, endereço, telefone, WhatsApp, horário, localização, redes sociais) | ✅ | ✅ | `GET/PUT /api/clinica` → **Supabase** `clinics` (`services/clinics.ts`) | ✅ `await` corrigido em 01/10/2026 e rota testada (200 + corpo real). |
| Médicos (nome, especialidade, horários, dias, duração, valor, status) | ✅ | ✅ | `GET/POST /api/professionals` + `PATCH/PUT/DELETE /api/professionals/[id]` → `services/doctors.ts` (`supabaseAdmin`) | ✅ **Fase 2.1 (01/10/2026):** a página deixou de falar com Supabase direto (client anônimo sem sessão) e passou para rotas de API como os demais cadastros. `clinic_id` é resolvido no servidor (`getDefaultClinicId()`), o que **eliminava o 42501 do `WITH CHECK` do RLS**. `email` entrou no `Doctor`/`DoctorView`. `src/lib/supabase.ts` perdeu o export `supabase` (anon) — só resta `supabaseAdmin`, fora do bundle de cliente. |
| Especialidades (nome, descrição, médicos relacionados) | 🟡 | ✅ | `GET/POST/PUT/DELETE /api/especialidades` → **Supabase** `specialties` | ✅ `await` corrigido e rota testada (200 + corpo real); `/medicos` lê a mesma tabela → dropdown consistente. Falta o vínculo "médicos relacionados" no modelo de UI. |
| Pacientes | ✅ | ✅ | `GET/POST /api/pacientes` → **Supabase** `patients` | ✅ **Fase 1.7 (01/10/2026):** `POST` agora resolve `clinic_id` via `getDefaultClinicId()` (coluna `NOT NULL` sem default) e `GET ?phone=` usa `maybeSingle()` — "não encontrado" (404) deixou de ser mascarado como erro de servidor. |
| Perfil / senha / e-mail | ✅ | ✅ | `/api/auth/{me,email,password}` → Supabase Auth | |

### 1.5 Regras de negócio (seção "Regras de Negócio" do PRD)

| Regra | Status | Referência |
|---|---|---|
| Agendamento no mesmo dia: só dentro do horário da clínica e até 2h antes | 🟡 | `getAvailableSlots` aplica `minStart = now + 120min` (`appointments.ts:148,168-170`), mas **não filtra pelo horário de funcionamento da clínica**; passo fixo de 30 min ignora `consultation_duration`. |
| Cancelamento gratuito até 4h antes (depois só humano) | 🟡 | Janela de 4h aplicada (`appointments.ts:265-267`); o "só humano depois das 4h" **não** existe como controle — a tool devolve erro ao LLM. |
| Remarcação gratuita até 4h, máx. 1 vez | ✅ | `appointments.ts:303-310,328` |
| No-show sem multa, horário liberado | 🟡 | Não há processo de liberação automática de horário de faltas. |
| Lembretes 24h/2h e retomada da IA ao responder | 🟡/❌ | Envio ok; **retomada da IA ao responder ao lembrete não é tratada de forma especial** (a mensagem entra no fluxo normal). |
| Nunca oferecer horários ocupados | 🟡 | Filtro por existência de `appointments` no Supabase (`isSlotAvailable`), mas sem trava de unicidade → dois "sim" simultâneos passam. |
| Reserva só após confirmação do paciente | ✅ | Instruído no prompt e na descrição da tool. |

### 1.6 Segurança, LGPD e operação

| Exigência | Status | Onde / observação |
|---|---|---|
| Login seguro | ✅ | Supabase Auth (e-mail/senha) + cookies `@supabase/ssr`; `requireAuth` em quase todas as rotas. ~~**Restos do auth legado:** `src/lib/auth.ts` (HMAC em SQLite) usado por `chat/layout.tsx`.~~ → **resolvido na Fase 2.2 (01/10/2026):** `/chat` agora usa `supabase.auth.getUser()` + papel de `admin_profiles`, `src/lib/auth.ts` e `auth.test.ts` foram **apagados** (zero consumidores). |
| Controle de acesso por perfil | ✅ | `AdminRole`, `proxy.ts` (Next 16) protege rotas por cookie; papéis em `admin_profiles`/`clinic_members`. **Fase 2.3 (01/10/2026):** lista `PROTECTED_ROUTES` == `config.matcher` (guardado por teste), `/configuracoes` coberto, API nunca redireciona e o **refresh da sessão agora é persistido pelo proxy** (antes era feito e descartado). ~~**signup não cria `clinic_members` nem clínica**~~ → **corrigido (Fase 0.2, 01/10/2026):** o signup cria `profiles` → `admin_profiles` → `clinics` → `clinic_members` com rollback em cascata, então `get_user_clinic_ids()` não fica vazio para usuário novo. |
| Criptografia dos dados | 🟡 | TLS/HSTS via `next.config.ts`; sem criptografia de repouso configurável pelo app. |
| Registro de atividades (audit log) | ❌ | Não existe tabela/fluxo de auditoria de ações. |
| Backup automático | ❌ | Fora do código, mas **não há nem documentação/verificação**; e o SQLite de produção vive em `/tmp`. |
| Conformidade LGPD | 🟡 | `src/lib/lgpd.ts` com políticas de retenção executadas no boot (`instrumentation.ts:12-21`) + páginas de privacidade/termos. |
| Segurança de webhook | ✅ | HMAC-SHA256 (`x-komunika-signature`), limite de 100KB, CORS restrito (`next.config.ts`), testes em `webhook.test.ts`. |
| — | ✅ | ~~`scripts/*.mjs` de reparo continham **senha fixa no repositório**.~~ **Resolvido (01/10/2026):** movidos para `scripts/ops/`, senha agora vem de `OPS_ADMIN_EMAIL`/`OPS_ADMIN_PASSWORD` no `.env` (não versionado) e há `scripts/ops/README.md` com o procedimento. **A senha antiga continua no histórico do git — rotação obrigatória** (ver lembrete ao final). |

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
| `20260911000005_auth_rls.sql` | 10,4 kB | Habilita RLS em 21 tabelas, cria `get_user_clinic_ids()`, policies `tenant_*` por clínica. **A FASE 5 (linhas 229-324), que fazia `INSERT` direto em `auth.users` e corrompeu o schema auth, foi REMOVIDA em 01/10/2026** e extraída para a `...000009` (evidência do incidente: cabeçalhos de `scripts/ops/diagnose-auth-schema.sql` e `scripts/ops/fix-auth-schema.sql`: *"Causa: Migration 005 fez INSERT direto em auth.users com colunas que podem nao existir ou triggers quebrados"*). |
| `20260930000006_professionals_unification.sql` | 9,7 kB | ✅ **aplicada.** Unifica `doctors`/`doctor_schedule` → `professionals` (com `schedule` estruturado), cria as FKs de `professionals→specialties`, `appointments→professionals` e `notifications→professionals`. |
| `20260930000007_appointments_clinic_fk.sql` | 1,9 kB | ✅ **aplicada.** FK `appointments→clinics` + `specialties→clinics` (habilita o embed `clinics(name, address)`). |
| `20260930000008_appointments_patient_fk.sql` | 1,8 kB | ✅ **aplicada (01/10/2026).** FK `appointments.patient_id → patients`; probe `appointments?select=id,patients(name)` → OK. Idempotente; zera `patient_id` órfão antes de criar a FK. |
| `20260930000009_admins_auth_link.sql` | 2,7 kB | ✅ **aplicada (01/10/2026).** Versão idempotente da FASE 5 da `005`: **não escreve em `auth.users`**, só vincula admins legados que já têm usuário no GoTrue. Verificado: `admin_profiles.user_id` `f9264de1-…` presente no GoTrue (**1/1 vinculado**). |
| `20260911000002_rls_fix.backup.sql` | 15,8 kB | Cópia de segurança (ignorada pelo git). |

**Problemas estruturais das migrações:**

1. **Sequência incompleta** — sem `000001`; dependência de um SQL solto na raiz.
2. **Ordem/Idempotência frágil** — `003` assume que `002` já rodou e renomeia tabelas; reaplicar gera erro ou recria `*_legacy`.
3. ~~**`005` não é seguro para executar em banco vivo (FASE 5)**~~ — **resolvido 01/10/2026:** FASE 5 removida da `005` e reescrita como `...000009` (idempotente, não toca em `auth.users`). A `005` **ainda não remove** as policies `USING(false)` antigas — as policies novas somam por OR, o que funciona, mas deixa regras mortas para trás.
4. **`doctor_schedule` policies apontam para `doctors_legacy`** (`005:176-210`), enquanto a tabela de negócio passou a ser `professionals` (migração `006`) — a política não corresponde a nenhuma tabela usada pela aplicação.
5. **Faltam constraints de negócio que o PRD exige:** `UNIQUE (doctor_id, starts_at)` em `appointments`; `UNIQUE (appointment_id, type)` em `reminders`; `UNIQUE`/índice em `conversations.phone`; índice em `appointments(starts_at)`.
6. **Estado real do banco não é verificável a partir do repositório** — não há log de aplicação, nem `supabase/config.toml`, nem script `migrate`. Os scripts em `scripts/` e `data/` (`audit_migration.js`, `check_supabase_tables.js`, `inspect_schemas.js`) são inspeção manual de 11/09.

### 1.9 ⚠️ Achado crítico: banco dividido (SQLite × Supabase) — **RESOLVIDO em 01/10/2026**

| Caminho de dados | Backend | Arquivos |
|---|---|---|
| ~~Agente IA, conversas, mensagens, lembretes, notificações, especialidades, clínica, assinatura/limites, stats, auth-antiga~~ | ~~**SQLite** (`node:sqlite`)~~ → **Supabase/Postgres** | `src/lib/services/*`, `src/lib/lgpd.ts` (ambos com `supabaseAdmin` async); `src/lib/db.ts`, `src/lib/multi-tenant.ts` e `src/lib/auth.ts` **removidos** |
| `pacientes`, `appointments` (API), `professionals`/`specialties` (página `/medicos`), `auth` (Supabase Auth), `profiles`/`admin_profiles`/`clinic_members` | **Supabase/Postgres** | `src/lib/supabase.ts`, `src/utils/supabase/*`, `src/app/api/{pacientes,appointments,auth}/*`, `src/app/(app)/medicos/page.tsx` |

**O que foi corrigido:**

- ~~**Produção (Vercel):** SQLite em `/tmp`, efêmero.~~ → não há mais SQLite no runtime; a fonte é sempre o Supabase.
- ~~**Divisão de cadastros:** médico de `/medicos` não era oferecido pelo agente.~~ → agente, `/medicos` e `/especialidades` leem `professionals`/`specialties`.
- ~~**Painel sem sessão:** `/medicos` gravava com client anônimo e o RLS rejeitava o INSERT (`42501` por `clinic_id` nulo).~~ → **corrigido na Fase 2.1:** rotas `/api/professionals` com `service_role` + `clinic_id` resolvido no servidor.
- ~~**Endpoint órfão:** dois CRUDs paralelos (`/api/appointments` × `/api/consultas`).~~ → **resolvido (Fase 1.5, 01/10/2026):** mantido `/api/appointments` (único com as regras do PRD: janela de 4h, limite de remarcação, `isSlotAvailable`); `/api/consultas` e `/api/consultas/[id]` **removidos** — nenhuma página os chamava (a página `/consultas` é server component e usa `listAppointments()`).
- ~~**Novo usuário sem tenant:** `signup` não criava `clinic_members` nem clínica.~~ → **resolvido (Fase 0.2, 01/10/2026).**

> Dado histórico (SQLite `data/saudesync.db`, ainda necessário para a migração de dados):
> `admins(1), clinics(1), specialties(9), doctors(8), doctor_schedule(42), conversations(12), messages(138)`
> — as demais tabelas estão vazias.

### 1.10 Órfãos e dívida técnica observada

- **Componentes não importados:** `kpi-card`, `appointments-list`, `doctor-status-list`, `appointment-requests-card`, `subscription-panel`, `upgrade-modal`, `animated-table-rows`, `animated-entry`.
- **`src/utils/supabase/client.ts`** (helper `createBrowserClient`) não é usado por nenhum componente — mantido como entry point para consultas client-side autenticadas futuras (pode virar órfão se a Fase 2.4 decidir que tudo passa por API).
- **Rotas sem consumidor na UI:** `/api/appointments`, `/api/stats`, `/api/conversations`, `/api/chat/history`, `/api/notifications/[id]`, `/api/especialidades/[id]`, `/api/pacientes/[id]`, `/api/subscription/{limits,usage}` (algumas são legítimas para uso externo/cron).
- ~~**Debug remanescente:** `console.log` extensivo em `api/auth/login/route.ts`.~~ → **removido (Fase 0.3).** Restam `console.log` por request em `webhooks/komunika/route.ts` (sem PII, só status/ids).
- **Testes (38, todos verdes)** cobrem: sanitização anti prompt-injection (`security.test.ts`), HMAC/filtro de eventos do webhook (`webhook.test.ts`) e a lista de rotas protegidas × `config.matcher` do `proxy.ts` (`src/__tests__/proxy.test.ts`, Fase 2.3). ~~Os 9 de **autenticação legada** (`auth.test.ts`) foram apagados na Fase 2.2 — testavam uma reimplementação dentro do próprio arquivo, não `src/lib/auth.ts`.~~ **Zero testes** para: agente, tools, `appointments` (regras de 4h/1 remarcação), lembretes, RLS, multi-tenant, login/signup reais (ver Fase 5.3).
- **README desatualizado:** ainda documenta `admin/admin123` e "o MVP usa `node:sqlite`" como se fosse definitivo.
- **`.github/workflows/ci.yml` usa Node 20**, enquanto `package.json` exige `>=22` e `.node-version` = 22 (local: v24.18.0). Com a remoção de `db.ts` o `node:sqlite` saiu de `src/`, então o **build** do CI deve passar; ainda assim o `engines` diverge e os `scripts/*.mjs` que usam `node:sqlite` (`setup-supabase.mjs`) exigem Node ≥ 22 — ver Fase 5.2.

---

## 2. Onde paramos

### 2.1 Estado do repositório

```
branch main
último commit: 67d65f0 (01/10/2026) feat(db): migrar persistencia de SQLite para Supabase e zerar lint
working tree: ALTERADA (toda a sessão 2 ainda não foi commitada)
não versionado: AgenteIA/  (cópia byte-a-byte do working tree, criada em 28/09/2026 13:37 — aparentemente backup/transferência)
```

Sequência dos commits que delimitaram a tarefa anterior (27/09–01/10/2026):

| Hora | Commit | Assunto |
|---|---|---|
| 27/09 ~22:09–22:31 | `848e7dd` | **fix(auth)**: debug logging na rota de login + `scripts/` de diagnóstico e reparo do auth |
| 27/09 22:41 | `9ef575b` | fix(ui): suprimir erro de script tag do next-themes |
| 27/09 22:50 | `9ee6520` | fix(ui): cores do modo claro |
| 01/10 | `67d65f0` | **feat(db)**: persistência única em Supabase + lint zerado (Fase 1) |

### 2.2 Tarefa anterior: **destravar a autenticação no Supabase Auth** — ✅ CONCLUÍDA

Evidências do estado em que ficou (27/09) e do que a sessão 2 fez:

1. **Causa raiz** documentada pelos próprios scripts:
   `scripts/ops/diagnose-auth-schema.sql` e `scripts/ops/fix-auth-schema.sql` declaram:
   > *"Causa: Migration 005 fez INSERT direto em auth.users com colunas que podem nao existir ou triggers quebrados"*
2. **Login validado de ponta a ponta (01/10/2026):** signIn direto no GoTrue OK →
   `POST /api/auth/login` **200** com `role: "admin"` e `clinicIds: ["1"]` → cookie
   `sb-…-auth-token` → `GET /api/auth/me` **200** → `GET /dashboard` **200**.
   Também: senha errada → **401** (`invalid_credentials`).
3. **`console.log` de depuração removidos** da rota de login (não há mais e-mail/UUID em log);
   `admin_profiles` ausente agora é **403 `PROFILE_MISSING`** e `clinic_members` vazio é
   **403 `CLINIC_MISSING`** (antes: fallback silencioso `role: "admin"` + painel em branco).
4. **Caixa de reparo integrada:** movida para `scripts/ops/` com `README.md`; senhas fixas
   removidas (agora `OPS_ADMIN_EMAIL`/`OPS_ADMIN_PASSWORD` no `.env`).
5. **FASE 5 da `005` extraída** para `...000009` idempotente — a `005` não pode mais
   corromper `auth.users` num re-run.

### 2.3 Tarefa concluída imediatamente antes (parêntese)

`9ee6520` — acessibilidade/contraste do modo claro em `src/app/globals.css` (+38/−39 linhas). Passada visual final, sem relação com o bloqueio de auth.

### 2.4 Estado de validação (reexecutado em 01/10/2026, sessão 2)

| Check | Comando | Resultado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ **0 erros** |
| Build | `npm run build` | ✅ **exit 0** — rotas geradas (API + páginas) + `ƒ Proxy (Middleware)` |
| Testes | `npm test` (vitest) | ✅ **38/38** em 3 arquivos (42 até a Fase 2.2, que apagou os 9 do auth legado; +5 do proxy na 2.3) |
| Lint | `npm run lint` (eslint) | ✅ **0 erros + 0 warnings**, agora com `await-thenable`, `no-floating-promises` e `no-misused-promises` ativos |
| Login E2E | `POST /api/auth/login` → `/api/auth/me` → `/dashboard` | ✅ 200 → 200 → 200 |
| Signup E2E | `POST /api/auth/signup` (usuário de teste) | ✅ 201; `profiles`+`admin_profiles`+`clinics`+`clinic_members` criados; login do novo usuário devolveu `clinicIds: ["2"]`; **usuário de teste removido após o teste** |
| Páginas com sessão | `/dashboard /consultas /medicos /especialidades /pacientes /chat /perfil /clinica /configuracoes/assinatura` | ✅ todas 200 |
| Portaria do `proxy.ts` (Fase 2.3) | 9 páginas protegidas + públicas + API | ✅ **sem sessão:** `/dashboard /configuracoes/assinatura /pacientes /chat /perfil` → **307 `/login`**; `/login /precos /agendamento-clinica-geral /landing` → **200**; `/api/auth/me` → 200, `/api/appointments` e `/api/stats` → **401** (nunca redirect). **Com sessão:** as 9 páginas → **200** |
| Renovação de sessão (Fase 2.3) | cookie com `expires_at` no passado → `/dashboard` e `/api/auth/me` | ✅ devolvem **`Set-Cookie`** com sessão nova (`expires_at` +60min, refresh token rotacionado) e a requisição seguinte dá 200 — **antes: 0 `Set-Cookie`** (o refresh era feito e descartado) |
| Rotas de dados | `/api/stats`, `/api/clinica`, `/api/especialidades`, `/api/conversations`, `/api/pacientes` | ✅ 200 com conteúdo real (antes `stats`/`clinica`/`especialidades` devolviam `{}`) |
| Cadastro de paciente | `POST /api/pacientes` → `GET /api/pacientes?phone=` | ✅ 201 (com `clinic_id` preenchido) → 200; telefone inexistente → **404** com mensagem própria (antes mascarado). Registro de teste removido após o teste |
| `/api/consultas` | — | ➖ **rota removida na Fase 1.5** (CRUD duplicado; use `/api/appointments`) — hoje devolve **404** |
| CRUD único de consultas | `GET /api/appointments` (com sessão) + página `/consultas` | ✅ **200** com `[]` (tabela vazia — o SQLite também não tinha consultas) e página **200** |
| Profissionais (Fase 2.1) | `GET/POST/PATCH/DELETE /api/professionals` (com sessão) | ✅ **401** sem sessão → **200** (10 itens) → **201** (criado) → **200** (patch) → **200** `{ok:true}` (delete); registro de teste removido (0 restantes) |
| Portaria das páginas (Fase 2.2) | `/chat`, `/dashboard` sem sessão vs. com sessão | ✅ sem sessão → **307** para `/login`; com sessão → **200** (`/chat`, `/dashboard`, `/medicos`, `/perfil`) |
| CI (`.github/workflows/ci.yml`) | lint → typecheck → test → build | ⚠️ **depende do Node** — `scripts/setup-supabase.mjs` e `scripts/ops/*.mjs` exigem Node ≥ 22; o job usa 20 |
| Migrações | — | ✅ **`002→009` no banco** (`008`/`009` aplicadas em 01/10/2026; preflight exit 0). Ainda falta o `...000001_schema_base.sql` (Fase 1.6) para banco limpo |
| E2E / smoke em produção | — | ❌ não realizado |

**Como as 33 ocorrências da sessão 2 foram zeradas (01/10/2026):**

| Regra | Como foi resolvido |
|---|---|
| `no-floating-promises` (15) | `void fetch(...)` em `clinica`, `assinatura`, `subscription-panel`; `await load()` em `especialidades`, `medicos`, `pacientes`; `await` em `deleteSpecialty`, `markAsRead`, `markAllAsRead` |
| `no-misused-promises` (3) | `if (!existing)` em `especialidades/[id]` agora usa `await getSpecialty(...)`; `requireInternalAuth(request)` em `komunika/setup` ganhou o `await` que faltava (o Bearer token nunca tinha funcionado) |
| `Promise serializado como {}` (4, não pego por regra) | `NextResponse.json(await getStats())`, `await getClinic()`, `await updateClinic()`, `await listSpecialties()`, `await createSpecialty(...)` — bug da conversão SQLite → Supabase |
| `no-unnecessary-type-assertion` (18) | `eslint --fix` (remoção de `as` redundantes em `services/*`; sem efeito em runtime) |

**Como os 36 erros de lint da rodada anterior foram zerados (01/10/2026, sessão 1):**

| Regra | Como foi resolvido |
|---|---|
| `react-hooks/set-state-in-effect` (20) | `useMounted()` novo (`src/lib/use-mounted.ts`) via `useSyncExternalStore` para o padrão "mounted"; chamadas `load()`/`fetchHistory()` dentro de `useEffect` envolvidas em IIFE assíncrona; media query do `login` e fechamento do menu móvel do `sidebar` reescritos (render-time adjustment / `useSyncExternalStore`) |
| `react-hooks/error-boundaries` (8) | `try/catch` de `src/app/(app)/layout.tsx` deixou de conter JSX — o `return` saiu para depois do bloco |
| `@typescript-eslint/no-require-imports` (8) | já zerados antes desta rodada |
| `@typescript-eslint/no-unused-vars` (27 → 0) | removidos `SkeletonCard`, `formatPrice`, `billingPeriod`, `PlanId`, `formatLimit`, `handleCheckout` + overlay de checkout órfão, `cmErr` e o binding `supabase` em `proxy.ts` |

> **Nota de operação (achado da sessão 2):** um `.next/` velho/corrompido faz o `next dev`
> devolver **404 em toda rota com 3+ segmentos** (`/api/auth/*`, `/api/appointments/1`,
> `/api/subscription/*`…), enquanto as rotas de 2 segmentos funcionam. Sintoma enganoso —
> parece bug de rota do app. Solução: parar o dev e apagar `.next/` (`next build` em seguida
> funciona normalmente).

### 2.5 O que permanece **não validado**

- Reaplicação das migrações `002`→`005` **num banco limpo** para provar o caminho do zero (Fase 2.5) — as `008`/`009` foram aplicadas e verificadas em 01/10/2026.
- Jornada completa no navegador (formulários do painel, não só chamadas de API).
- Envio/recebimento real via KOMUNIKA (HMAC, eventos, numeração).
- Disparo dos lembretes fora de `npm run dev`.
- Comportamento do app em Vercel (build + cron).

---

## 3. Fases e tarefas cruciais até a entrega final

> Ordem sugerida. "P0" = bloqueia a entrega; "P1" = degrada o MVP; "P2" = qualidade/escopo.

### Fase 0 — Destravar (P0) — ✅ CONCLUÍDA em 01/10/2026

- [x] **0.1** Confirmar/repairar `auth.users` e validar **um login real** de ponta a ponta (login → cookie → `/dashboard` → `GET /api/auth/me`). — **feito**: 200/200/200; senha errada → 401.
- [x] **0.2** `signup` passa a criar, na transação correta: usuário → `profiles` → `admin_profiles` → **`clinic_members` + `clinics`** (sem isso, RLS devolve vazio). — **feito**: rota reescrita com rollback em cascata (inclusive `deleteUser`), payload da página corrigido (`username` → `name`) e E2E testado com usuário temporário removido depois. `login` agora bloqueia tenant ausente com **403 explícito**.
- [x] **0.3** Remover os `console.log` de depuração de `api/auth/login/route.ts` e tratar `admin_profiles`/`clinic_members` ausentes como erro explícito (hoje viram fallback silencioso: `role: "admin"`). — **feito**: logs sem PII; `PROFILE_MISSING`/`CLINIC_MISSING` → 403.
- [x] **0.4** Decidir o destino dos `scripts/*.mjs` de reparo: mover para `scripts/ops/`, **remover a senha fixa do repositório** e documentar o procedimento. — **feito**: 6 arquivos movidos, senhas saem de `OPS_ADMIN_*`, `scripts/ops/README.md` criado.
- [x] **0.5** Corrigir o que motivou a migração de emergência: a FASE 5 da migração `005` não pode ser re-executada — extraí-la para um script idempotente e versionado. — **feito**: FASE 5 removida da `005` (com comentário apontando para a nova) e reescrita em `...000009`, que **não escreve em `auth.users`**.

### Fase 1 — Unificar a persistência (P0) — *questão estrutural nº 1* — ⏳ 7 de 8 concluídas

- [x] **1.1** **Decisão de arquitetura** — **decidido: Supabase como banco único** (01/10/2026).
- [x] **1.2** Reescrever `src/lib/db.ts` + `src/lib/services/*` sobre `supabaseAdmin` — **feito**: `db.ts` e `multi-tenant.ts` removidos; serviços, auth, lgpd, agente, rotas API, server components e `instrumentation` convertidos para `supabaseAdmin` async.
- [x] **1.3** Eliminar a dependência de `/tmp` — **feito**: o runtime não abre mais `data/saudesync.db` (SQLite só é lido por `scripts/setup-supabase.mjs`).
- [x] **1.4** Definir **uma** fonte para médicos e especialidades — **feito**: tudo lê `professionals` / `specialties` no Supabase.
- [x] **1.5** Remover um dos CRUDs duplicados: alinhar `/api/appointments` × `/api/consultas` (manter um; atualizar `/consultas`). — **feito (01/10/2026):** mantido `/api/appointments` (GET/POST + `[id]` GET/PATCH/PUT/DELETE com janela de 4h, limite de 1 remarcação e `isSlotAvailable`); removidos `src/app/api/consultas/route.ts` e `src/app/api/consultas/[id]/route.ts`. A página `/consultas` já usava `listAppointments()` (server component) e não foi afetada. Consequência: nenhum SELECT do app embute mais `patients` → a `008` deixou de ser bloqueio.
- [ ] **1.6** Criar migração **`20260911000001_schema_base.sql`** a partir de `supabase-migration.sql` (ou mover o arquivo para `supabase/migrations/`), para que `supabase db push` funcione do zero.
- [x] **1.7** `POST /api/pacientes` sem `clinic_id` (coluna `NOT NULL` sem default) e `GET ?phone=` mascarando erro de `single()` como 404. — **feito (01/10/2026):** `clinic_id` resolvido via `getDefaultClinicId()` (ou vindo do corpo) e lookup com `maybeSingle()` — 201/200/404 validados em dev, registro de teste removido.
- [x] **1.8** **Dados do SQLite → Supabase** — **feito (01/10/2026)**: `006`, `007`, `008` e `009` aplicadas, `node scripts/setup-supabase.mjs --apply` executado (161 inseridos / 5 atualizados; reexecução = 0). Preflight com exit 0 e smoke pós-migração: `/dashboard`, `/consultas`, `/api/auth/me`, `/api/appointments`, `/api/stats`, `/api/pacientes`, `/api/clinica`, `/api/especialidades` → **todos 200**.

> **Próximo passo (é onde paramos agora):** Fase 1 está **7/8** (resta a `1.6` —
> `...000001_schema_base.sql` para banco limpo) e a Fase 2 está em **3 de 6**
> (2.1, 2.2 e 2.3 ✅). Seguir para a **2.4** (definir quem usa `service_role` ×
> `anon` × `authenticated` e remover o `GRANT ALL ... TO anon` da migração `004`).

### Fase 2 — Auth, tenant e RLS (P0/P1) — ⏳ 3 de 6 concluídas

- [x] **2.1** Trocar `src/lib/supabase.ts` (client anônimo sem sessão) por `createBrowserClient` de `@supabase/ssr` em **`src/app/(app)/medicos/page.tsx`** — hoje a página quase certamente lê vazio e não consegue gravar por causa do RLS. — **feito (01/10/2026), em vez do caminho literal:** diagnóstico primeiro mostrou que a **leitura** funcionava com a sessão (anon key + JWT → `clinic_id: 1`, `get_user_clinic_ids()` = `[1]`), mas o **INSERT devolvia `42501`** porque a página não envia `clinic_id` (coluna sem default) e o `WITH CHECK` do `tenant_insert` rejeita. Decisão do produto: seguir pelo caminho dos demais cadastros — criadas `GET/POST /api/professionals` e `PATCH/PUT/DELETE /api/professionals/[id]` sobre `services/doctors.ts` (`supabaseAdmin` + `getDefaultClinicId()`), página reescrita para `fetch`, `email` adicionado a `Doctor`/`DoctorView`/`createDoctor`/`updateDoctor` e o export `supabase` (anon) removido de `src/lib/supabase.ts` (agora só existe `supabaseAdmin`, e nenhum componente de cliente importa Supabase direto). **E2E:** sem sessão → 401; GET → 200 (10 profissionais, com `specialty_name` e agenda); POST → 201; PATCH → 200; DELETE → 200; página `/medicos` → 200.
- [x] **2.2** Aposentar o auth legado: `chat/layout.tsx:5,8` lê o cookie HMAC antigo → **`/chat` está inacessível em produção**. Migrar para `supabase.auth.getUser()` + checagem de papel. — **feito (01/10/2026):** `chat/layout.tsx` agora usa `createClient()` (server) + `getUser()` + papel de `admin_profiles` (RLS de próprio registro) e **liberou para qualquer papel de admin** (decisão de produto: `admin` é o papel real do usuário; antes o gate `super_admin`/`saas_admin` + bypass de dev escondia o problema). `sidebar.tsx` perdeu `superAdminOnly`, `canAccessItem` e o bypass `NODE_ENV===development`; `(app)/layout.tsx` parou de buscar `admin_profiles` só para a sidebar. **`src/lib/auth.ts` e `src/lib/__tests__/auth.test.ts` apagados** (zero consumidores; os testes reimplementavam a lógica em vez de importar o módulo). **E2E:** sem sessão → 307 `/login`; com sessão → `/chat` 200, `/dashboard` 200, `/medicos` 200, `/perfil` 200.
- [x] **2.3** Revisar `proxy.ts`: matcher não cobre `/configuracoes`, `/pacientes` está no matcher mas o redirect checa `/settings` e `/appointments` (rotas que não existem). — **feito (01/10/2026):** lista `PROTECTED_ROUTES` derivada das 9 páginas reais do grupo `(app)`, removidos `/settings` e `/appointments` (não existem), **`/configuracoes` adicionado** (antes `configuracoes/assinatura` passava pelo proxy e só o `layout` fazia a checagem), matcher alinhado à lista e **`/api/:path*` incluído** com comportamento de refresh-only (API nunca redireciona — continua 401 do handler). Checagem de cookie agora aceita **chunks** (`sb-<ref>-auth-token.0`). **Achado corrigido:** o proxy criava o client do Supabase e o descartava (`void supabase`), então o **refresh da sessão era feito e jogado fora** — Server Component não consegue gravar cookie e `/api/auth/me` usa `setAll() {}`; um cookie com `expires_at` no passado devolvia **0 `Set-Cookie`**. Agora o proxy chama `getSession()` (em `try/catch`) e persiste a sessão: mesmo cookie expirado → **`Set-Cookie`** com `expires_at` +60min e o próximo request dá 200. **Teste de regressão:** `src/__tests__/proxy.test.ts` (5 testes) falha se `PROTECTED_ROUTES` e `config.matcher` saírem de sincronia. **E2E:** sem sessão → 307 nas 9 páginas e 200 nas públicas (`/login`, `/precos`, `/agendamento-*`, `/landing`), API sem sessão → 401/200 **nunca** redirect; com sessão → 9/9 páginas 200.
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
- [ ] **5.3** Alçar cobertura: testes de regras de negócio (`appointments`: 4h/1 remarcação/2h), do agente (loop, transferência, quota), do scheduler de lembretes **e do fluxo real de login/signup** (a Fase 2.2 apagou os 9 do auth legado). Hoje 33 testes cobrem apenas sanitização e HMAC de webhook.
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
npm test                                # ✅ 38/38
npm run lint                            # ✅ 0 erros, 0 warnings
node scripts/setup-supabase.mjs         # dry-run do SQLite -> Supabase
node scripts/setup-supabase.mjs --apply # executa (rode depois da migração 006)
node -v                                 # v24.18.0 (local) / CI: 20  ← divergente de engines >=22
```

---

> ⚠️ LEMBRETE DE SEGURANCA: Nao se esqueca de realizar a rotatividade obrigatoria das chaves expostas no Git (OPENAI_API_KEY, KOMUNIKA_API_TOKEN, KOMUNIKA_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY e LOJOU_WEBHOOK_SECRET) diretamente nos paineis das plataformas e atualizar as variaveis no ambiente da Vercel.
