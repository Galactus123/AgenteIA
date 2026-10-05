# PROGRESSO — SaúdeSync

**Auditoria de estado do projeto**

| Item | Valor |
|---|---|
| Data da auditoria | 30/09/2026 |
| Última atualização | 05/10/2026 (sessão 8 — Fase 6 concluída: 6.1–6.6; histórico varrido sem chaves, audit log com 13 eventos/rotas, rate limiting em auth+webhooks, PII mascarada, backups limpos, README de backup/LGPD) |
| Documento de requisitos | `PRD-SaudeSync.md` v1.1 |
| Branch / commit base | `main` sincronizado com `origin/main` — última entrega: **Fase 5** (05/10/2026) |
| Commits totais | 92 (primeiro: `7279797` "iniciar", 15/08/2026) |
| Código | `src/` — 146 arquivos, ~14.000 linhas (`.ts`/`.tsx`) |
| Árvore de trabalho | limpa após o commit da Fase 6; `data/**` fica fora do `tsconfig`/`eslint` (copia `AgenteIA/` e `*.log` de execução já não existem/versionam) |
| Stack | Next.js 16.2.12 (App Router + `proxy.ts`), React 19.2.4, Supabase (Postgres + Auth) — **persistência única** (o `node:sqlite` em runtime foi removido; `data/saudesync.db` só é lido por `scripts/setup-supabase.mjs`), Vitest 5, Vercel |

---

## 0. Resumo executivo

1. **A maior parte da UI e do "ciclo do agente" foi construída.** Landing, login, dashboard, cadastros, chat interno, assinatura, 32 rotas de API e um agente LLM com 7 tools (especialidade → horário → agendar → remarcar → cancelar → transferir) existem e compilam.
2. ~~**O projeto está dividido em dois bancos de dados que não conversam.**~~ **RESOLVIDO (01/10/2026):** `src/lib/db.ts` e `src/lib/multi-tenant.ts` foram removidos e todos os serviços, rotas, server components, o agente e a LGPD passaram a usar `supabaseAdmin` de forma assíncrona. Persistência única: Supabase.
3. **A cadeia de migrações está completa e validada do zero:** existe `20260911000001_schema_base.sql` (Fase 1.6 — o schema base saiu de `supabase-migration.sql` na raiz, que foi **removido**); `008`/`009` aplicadas no banco vivo em 01/10/2026; e a **Fase 2.5 (02/10/2026)** provou a cadeia **11/11 migrations em um Postgres 16 limpo** via `scripts/ops/clean-db-test.mjs` (log em `scripts/ops/clean-db-run.log`). A `005` perdeu a FASE 5 (a que corrompeu `auth.users`), agora extraída para a `009` idempotente.
4. ~~**O MVP não está pronto para produção:** lembretes 24h/2h dependem de um `setInterval` (morre em serverless, não há `vercel.json`/cron), não há fila de reenvio em falha da API de WhatsApp, não há trava de conflito de horário, e a transferência para humano não interrompe a IA.~~ **RESOLVIDO (02/10/2026, sessão 4 — Fase 3.1–3.5):** cron real via **pg_cron + pg_net no Supabase** (a Vercel Hobby só aceita cron diário) + `vercel.json` de segurança; `setInterval` virou fallback só-dev; lembretes idempotentes via `ON CONFLICT DO NOTHING`; trava de horário com `SlotTakenError` (23505 → 409 amigável no serviço, na API e no agente); fila **`outbox`** com backoff e webhook devolvendo `5xx` em erro fatal; transferência real (IA para em `transferred`, não continua o loop, recepção é notificada com o histórico). **Pendência operacional:** aplicar `20261002000003`/`20261002000004` no SQL Editor e configurar os segredos do Vault + `CRON_SECRET` (ver log da Fase 3).
5. **Validação atual (01/10/2026, sessão 2):** `tsc` ✅ · `next build` ✅ · `vitest` ✅ (38 testes — os 9 da autenticação legada saíram na Fase 2.2 e 5 de rota/proxy entraram na 2.3) · `eslint` ✅ **0 erros / 0 warnings com regras type-aware novas** (`await-thenable`, `no-floating-promises`, `no-misused-promises`) — estas regras pegaram e foi corrigido um bug de classe da conversão SQLite → Supabase (services viraram `async` e 15 chamadas ficaram sem `await`, serializando `Promise` como `{}`). **Revalidado em 02/10/2026 (sessão 3):** `eslint` ✅ 0/0 · `tsc` ✅ · `vitest` ✅ 38/38 · `next build` ✅ (45 páginas) — sessão sem alteração em `src/` (só migrações, `scripts/ops/` e este documento). **Revalidado em 02/10/2026 (sessão 4, Fase 3.1–3.5):** `eslint` ✅ 0/0 · `tsc` ✅ · `vitest` ✅ **50/50** (12 novos em `src/lib/__tests__/fase3.test.ts`) · `next build` ✅ · cadeia limpa **13/13 migrations · 11/11 CHECKs · 3/3 testes de papel · exit 0** — inclui `outbox` (25ª tabela, RLS deny-all, `anon` revogado) e o caminho de agendamento do cron validado com stubs. **Revalidado em 05/10/2026 (sessão 6, Fase 4):** `eslint` ✅ 0/0 · `tsc` ✅ · `vitest` ✅ **79/79** (6 arquivos, +3 novos em `src/lib/__tests__/stats.test.ts`) · `next build` ✅ exit 0. **Revalidado em 05/10/2026 (sessão 7, Fase 5):** `eslint` ✅ 0/0 · `tsc` ✅ · `vitest` ✅ **103/103** (9 arquivos, +24 novos) · `test:coverage` ✅ exit 0 com thresholds · `next build` ✅ exit 0. **Revalidado em 05/10/2026 (sessão 8, Fase 6):** `eslint` ✅ 0/0 · `tsc` ✅ · `vitest` ✅ **121/121** (11 arquivos, +18 novos) · `test:coverage` ✅ exit 0 — cobertura **21.97% stmt / 13.77% branch / 23.19% func / 23.38% lines** · `next build` ✅ exit 0 · cadeia de migrations **14/14 em banco limpo (Docker), exit 0** · relatório LGPD real exit 0.

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
presentes). **Fase 1.6 concluída em 02/10/2026:** `...000001_schema_base.sql`
criada e `supabase-migration.sql` (raiz) removido — a sequência `000001`→`011`
está completa.

---

## 1. Auditoria: o que foi implementado vs. o que o PRD exige

**Legenda:** ✅ implementado · 🟡 implementado parcialmente / com ressalva crítica · ❌ não implementado

### 1.1 Ciclo completo do MVP (conversa → especialidade → agendamento → confirmação → lembretes → remarcação/cancelamento)

| # | Requisito do PRD | Status | Onde está | Ressalva |
|---|---|---|---|---|
| 1 | Agente de IA conversando pelo WhatsApp | ✅ | `src/app/api/webhooks/komunika/route.ts`, `src/lib/agent/agent.ts`, `src/lib/services/komunika.ts`, fila `src/lib/services/outbox.ts` | Webhook com HMAC, filtro de eventos e `waitUntil` ok. **Fase 3.4 (02/10/2026):** mensagens de saída passam pela fila `outbox` (backoff até 5 tentativas); erro fatal agora devolve **5xx** para a KOMUNIKA reenviar (antes o `catch` externo devolvia `200`). |
| 2 | Entendimento do motivo / sugestão de especialidade | ✅ | `src/lib/agent/prompts.ts`, tool `list_specialties` (`tools.ts:9-14`) | LLM configurável (`OPENAI_BASE_URL`/`OPENAI_MODEL`). Sanitização anti prompt-injection em `agent/security.ts` (testada). |
| 3 | Consulta de disponibilidade e agendamento automático | ✅ | tools `get_availability`/`book_appointment` (`tools.ts:18-50`), `services/appointments.ts` | Revalida slot antes de gravar (`tools.ts:123-128,202`) e, desde a Fase 3.3, a gravação tem trava no Postgres: `UNIQUE (doctor_id, starts_at)` + `SlotTakenError` → 409/alternativas. |
| 4 | Confirmação enviada ao paciente | ✅ | retorno de `book_appointment` → mensagem do bot (`agent.ts:144-148`) | Inclui médico, especialidade, data/hora, clínica e preço. |
| 5 | Lembretes automáticos 24h e 2h | ✅ | `src/lib/services/reminders.ts`, `reminder-scheduler.ts` (dev), pg_cron (migração `20261002000004`), `GET\|POST /api/reminders/run`, `vercel.json` | **Fase 3.1/3.2 (02/10/2026):** gatilho em produção via pg_cron do Supabase a cada 5 min (+ `vercel.json` diário de segurança); `setInterval` só em dev; idempotência real com `UNIQUE (appointment_id, type)` + `ON CONFLICT DO NOTHING`. **Pendência:** aplicar `000004` e criar os segredos do Vault. |
| 6 | Remarcação automática | ✅ | tool `reschedule_appointment` + `appointments.ts` (`MAX_RESCHEDULES=1`) | Janela de 4h e limite de 1 remarcação conferidos. |
| 7 | Cancelamento automático + liberação do horário | ✅ | tool `cancel_appointment` + `appointments.ts` (`CANCEL_WINDOW_HOURS=4`) | Cancelamento não tem confirmação em duas etapas no código (depende do prompt/LLM). |
| 8 | Transferência para atendente humano | ✅ | tool `transfer_to_human` (`tools.ts`), `agent.ts` (guardas de status + `break` no loop), `services/transfers.ts`, notificação `type:"transfer"` | **Fase 3.5 (02/10/2026):** `handlePatientMessage` lê `conversation.status` — `transferred` responde `TRANSFER_WAITING_REPLY` sem chamar a LLM; no loop, após a tool, atualiza a conversa, notifica a recepção com o histórico (notification de tipo "transferência") e **quebra** antes de gerar mais resposta; pós-loop devolve `HUMAN_TRANSFER_NOTICE`. `WAITING_HUMAN_INTERVENTION` retoma se há cota de IA. |
| 9 | Tratamento de erros e concorrência | ✅ | `tools.ts` (erros viram texto para o LLM, `slotTakenWithAlternatives`), `SlotTakenError`/`isUniqueViolation` em `appointments.ts` | **Fase 3.3/3.4 (02/10/2026):** horário disputado resolvido por `UNIQUE (doctor_id, starts_at)` → 23505 vira 409 "horário acabou de ser ocupado" com alternativas no serviço, na API e no agente; fila `outbox` cobre falha de envio WhatsApp. "IA sem certeza" parcial via prompt/fallback (`agent.ts`). |

### 1.2 Funcionalidades principais do PRD (itens 1–9)

| Item do PRD | Status | Observação |
|---|---|---|
| 1. Entendimento inteligente do motivo | ✅ | |
| 2. Sugestão automática da especialidade | ✅ | |
| 3. Agendamento automático | ✅ | |
| 4. Confirmação da consulta | ✅ | Localização da clínica incluída; "orientações de preparo" não existe no modelo. |
| 5. Lembretes automáticos | ✅ | Ver 1.1 #5 — gatilho em produção resolvido (pg_cron + vercel.json, Fase 3.1). |
| 6. Remarcação automática | ✅ | |
| 7. Cancelamento automático | ✅ | |
| 8. Transferência para humano | ✅ | Ver 1.1 #8 — resolvido na Fase 3.5. |
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
| `20260911000001_schema_base.sql` | 9,6 kB | ✅ **criada (Fase 1.6, 02/10/2026)** a partir de `supabase-migration.sql` (arquivo da raiz **removido**). 17 tabelas + seed "Clinica Vida" + RLS `USING(false)` + revogação de `anon`. **Desvio documentado no cabeçalho:** `clinic_members`, `subscriptions` e `usage` já nascem no **shape definitivo** da `003` (PK UUID, `user_id` → `auth.users`, `TIMESTAMPTZ`) — se fossem criadas no shape antigo (BIGSERIAL/BIGINT), o `IF NOT EXISTS` da `003` as manteria velhas num banco limpo e o INSERT de signup (`user_id` UUID) quebraria. |
| `20260911000002_rls_fix.sql` | 15,8 kB | Adiciona `clinic_id` (com `DEFAULT 1`) em 8 tabelas, popula dados, índices, habilita RLS e cria policies `USING (false)` (bloqueio total de `anon`); documenta que o app ainda usava cookies HMAC + `service_role`. **Guardas da Fase 2.5 (02/10/2026):** FASE 3 (bridge `clinic_members.admin_id`) e FASE 4 (índice em `admin_id`) agora checam a coluna antes — no shape definitivo ela não existe e os blocos são pulados com NOTICE. |
| `20260911000003_schema_definitivo.sql` | 28,3 kB | "v6": cria `patients`/`professionals`, migra dados PT→EN, cria `profiles`, `clinic_members`, `subscriptions`, `usage`, `units`, `medical_records`, `admin_profiles`, renomeia `*_legacy` e `doctors`→`doctors_legacy`. **Guarda da Fase 2.5 (02/10/2026):** toda a FASE 2 (DML PT→EN, seções 2.1–2.5) agora roda dentro de `DO` com `to_regclass` na tabela fonte — em banco limpo não existem `especialidades`/`medicos`/`pacientes`/`consultas` e cada seção é pulada com NOTICE. |
| `20260911000004_grant_permissions.sql` | 3,4 kB | **Editada (Fase 2.4):** `GRANT ALL ... TO service_role, authenticated` (sem `anon`). **Guarda da Fase 2.5 (02/10/2026):** os 27 grants viraram um loop com `to_regclass` — em banco limpo `doctors` (renomeada pela `003`) e as 4 `*_legacy` portuguesas não existem e o grant é pulado com NOTICE em vez de abortar. |
| `20260911000005_auth_rls.sql` | 10,4 kB | Habilita RLS em 21 tabelas, cria `get_user_clinic_ids()`, policies `tenant_*` por clínica. **A FASE 5 (linhas 229-324), que fazia `INSERT` direto em `auth.users` e corrompeu o schema auth, foi REMOVIDA em 01/10/2026** e extraída para a `...000009` (evidência do incidente: cabeçalhos de `scripts/ops/diagnose-auth-schema.sql` e `scripts/ops/fix-auth-schema.sql`: *"Causa: Migration 005 fez INSERT direto em auth.users com colunas que podem nao existir ou triggers quebrados"*). |
| `20260930000006_professionals_unification.sql` | 9,7 kB | ✅ **aplicada.** Unifica `doctors`/`doctor_schedule` → `professionals` (com `schedule` estruturado), cria as FKs de `professionals→specialties`, `appointments→professionals` e `notifications→professionals`. |
| `20260930000007_appointments_clinic_fk.sql` | 1,9 kB | ✅ **aplicada.** FK `appointments→clinics` + `specialties→clinics` (habilita o embed `clinics(name, address)`). |
| `20260930000008_appointments_patient_fk.sql` | 1,8 kB | ✅ **aplicada (01/10/2026).** FK `appointments.patient_id → patients`; probe `appointments?select=id,patients(name)` → OK. Idempotente; zera `patient_id` órfão antes de criar a FK. |
| `20260930000009_admins_auth_link.sql` | 2,7 kB | ✅ **aplicada (01/10/2026).** Versão idempotente da FASE 5 da `005`: **não escreve em `auth.users`**, só vincula admins legados que já têm usuário no GoTrue. Verificado: `admin_profiles.user_id` `f9264de1-…` presente no GoTrue (**1/1 vinculado**). |
| `20261002000002_drop_dead_policies.sql` | 4,4 kB | ✅ **criada e validada em banco limpo (Fase 2.6, 02/10/2026).** Descarta dinamicamente toda policy `USING (false)` (17 `*_isolation` + `anon_blocked` × 6 + `api_access_log_block` = **24 removidas**), remove as `ds_tenant_*` de `doctor_schedule` (apontavam para `doctors_legacy`; reapontar para `professionals` é impossível — `doctor_id` BIGINT × `id` UUID — e o app não lê a tabela) e habilita RLS + revoga `anon`/`authenticated` nas 4 `*_legacy` portuguesas (ausentes em banco limpo). Inclui consultas de verificação. |
| `20260911000002_rls_fix.backup.sql` | 15,8 kB | Cópia de segurança — **movida de `supabase/migrations/` para `data/`** em 02/10/2026 (fica fora do caminho do `supabase db push`). |

**Problemas estruturais das migrações:**

1. ~~**Sequência incompleta** — sem `000001`; dependência de um SQL solto na raiz.~~ — **resolvido (Fase 1.6, 02/10/2026):** `20260911000001_schema_base.sql` criada; `supabase-migration.sql` removido da raiz.
2. **Ordem/Idempotência frágil** — `003` assume que `002` já rodou e renomeia tabelas; reaplicar gera erro ou recria `*_legacy`. (Em **banco limpo** a cadeia agora roda limpa — Fase 2.5; em **banco vivo** não se reexecuta `002`/`003`/`005`, que não são idempotentes.)
3. ~~**`005` não é seguro para executar em banco vivo (FASE 5)**~~ — **resolvido 01/10/2026:** FASE 5 removida da `005` e reescrita como `...000009` (idempotente, não toca em `auth.users`). ~~A `005` ainda não remove as policies `USING(false)` antigas~~ — **resolvido (Fase 2.6, 02/10/2026)** pela `20261002000002_drop_dead_policies.sql`.
4. ~~**`doctor_schedule` policies apontam para `doctors_legacy`**~~ — **resolvido (Fase 2.6, 02/10/2026):** `ds_tenant_*` removidas (tabela legada, RLS deny-all; o app usa `professionals.schedule`).
5. ~~**Faltam constraints de negócio que o PRD exige**~~ — **resolvido pela `006` (01/10/2026):** `uq_appointments_professional_start`, `uq_reminders_appointment_type`, `uq_conversations_phone` + `idx_appointments_starts_at`.
6. ~~**Estado real do banco não é verificável a partir do repositório**~~ — **parcialmente resolvido (Fase 2.5, 02/10/2026):** `scripts/ops/clean-db-test.mjs` sobe um Postgres 16 limpo (Docker), aplica bootstrap + 11 migrations com `ON_ERROR_STOP=1` e roda 11 CHECKs + 3 testes de papel; log completo em `scripts/ops/clean-db-run.log`. A aplicação **no banco vivo** continua manual (SQL Editor) — não há `supabase/config.toml` nem CI de banco.

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

- **Componentes não importados:** ~~`kpi-card`, `appointments-list`, `doctor-status-list`, `appointment-requests-card`, `animated-table-rows`, `animated-entry`~~ → **removidos na Fase 4.4 (05/10/2026)**; restam `subscription-panel` e `upgrade-modal`, **congelados** até a decisão de produto nº 4 (são os únicos consumidores de `GET /api/subscription` e `POST /api/subscription/buy-overage-pack`).
- ~~**`src/utils/supabase/client.ts`** (helper `createBrowserClient`) não é usado por nenhum componente~~ → **removido na Fase 2.4 (02/10/2026)** — com `anon` sem GRANT de tabela ele não teria uso; o navegador consulta só via API.
- **Rotas sem consumidor na UI:** `/api/appointments`, `/api/stats`, `/api/conversations`, `/api/pacientes/[id]`, `/api/subscription/{limits,usage,checkout}` — ~~algumas são legítimas para uso externo/cron~~ → **destino definido na Fase 4.4 (05/10/2026):** nenhuma removida, cada uma classificada como CRUD público/leitura para integração/superfície de cobrança congelada/setup manual/monitoramento/webhook/cron (ver 4.4). `/api/chat/history`, `/api/notifications/[id]`, `/api/especialidades/[id]` **não** são órfãos — são consumidos pela UI.
- ~~**Debug remanescente:** `console.log` extensivo em `api/auth/login/route.ts`.~~ → **removido (Fase 0.3).** Restam `console.log` por request em `webhooks/komunika/route.ts` (sem PII, só status/ids).
- **Testes (121, todos verdes)** cobrem: sanitização anti prompt-injection (`security.test.ts`), HMAC/filtro de eventos do webhook (`webhook.test.ts`), rotas protegidas × `config.matcher` (`proxy.test.ts`), regras de `appointments` (`fase3-regras.test.ts`), outbox/cron/transferência (`fase3.test.ts`), métricas (`stats.test.ts`), agente: loop/transferência/quota (`agent.test.ts`, Fase 5.3), scheduler de lembretes (`scheduler.test.ts`, Fase 5.3), login/signup reais (`auth-flows.test.ts`, Fase 5.3), **rate limiting (`rate-limit.test.ts`) e audit log (`audit.test.ts`, Fase 6.3/6.6)**. ~~Os 9 de **autenticação legada** (`auth.test.ts`) foram apagados na Fase 2.2 — testavam uma reimplementação dentro do próprio arquivo, não `src/lib/auth.ts`.~~ Ainda **sem teste direto**: `tools.ts` (exercitada via agente), RLS, multi-tenant, webhooks de cobrança e integração GoTrue (Fase 7.2).
- **README desatualizado:** ~~documenta "o MVP usa `node:sqlite`" como se fosse definitivo~~ → **corrigido na Fase 5.2 (05/10/2026)**; ~~ainda documenta `admin/admin123`~~ → **corrigido na Fase 6.2 (05/10/2026)** (acesso via signup + `scripts/ops/README.md`). README agora tem também as seções de **Backup/restauração** e **Privacidade (LGPD)** (Fase 6.4).
- ~~**`.github/workflows/ci.yml` usa Node 20**, enquanto `package.json` exige `>=22` e `.node-version` = 22~~ → **corrigido na Fase 5.2 (05/10/2026):** os dois jobs usam Node 22 e o job de teste roda `npm run test:coverage` com thresholds (Fase 5.4).

---

## 2. Onde paramos

### 2.1 Estado do repositório

```
branch main
último commit: 67d65f0 (01/10/2026) feat(db): migrar persistencia de SQLite para Supabase e zerar lint
working tree: ALTERADA (toda a sessão 2 ainda não foi commitada)
não versionado: AgenteIA/  (cópia byte-a-byte do working tree, criada em 28/09/2026 13:37 — aparentemente backup/transferência)
  ↑ snapshot de 01/10: a cópia `AgenteIA/` foi **removida na Fase 6.5 (05/10/2026)**, após conferir que os 20 arquivos exclusivos dela existiam no histórico do git.
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
| Grants de `anon` (Fase 2.4) | `20261002000001_revoke_anon_grants.sql` no SQL Editor + probe `anon` no PostgREST | ✅ migration executada (3 consultas vazias); `anon` → **401 `42501 permission denied`** em 4 tabelas (antes `200` + `[]`); GoTrue login com anon → OK; app logado → 9/9 páginas 200 e 8 APIs 200 |
| Rotas de dados | `/api/stats`, `/api/clinica`, `/api/especialidades`, `/api/conversations`, `/api/pacientes` | ✅ 200 com conteúdo real (antes `stats`/`clinica`/`especialidades` devolviam `{}`) |
| Cadastro de paciente | `POST /api/pacientes` → `GET /api/pacientes?phone=` | ✅ 201 (com `clinic_id` preenchido) → 200; telefone inexistente → **404** com mensagem própria (antes mascarado). Registro de teste removido após o teste |
| `/api/consultas` | — | ➖ **rota removida na Fase 1.5** (CRUD duplicado; use `/api/appointments`) — hoje devolve **404** |
| CRUD único de consultas | `GET /api/appointments` (com sessão) + página `/consultas` | ✅ **200** com `[]` (tabela vazia — o SQLite também não tinha consultas) e página **200** |
| Profissionais (Fase 2.1) | `GET/POST/PATCH/DELETE /api/professionals` (com sessão) | ✅ **401** sem sessão → **200** (10 itens) → **201** (criado) → **200** (patch) → **200** `{ok:true}` (delete); registro de teste removido (0 restantes) |
| Portaria das páginas (Fase 2.2) | `/chat`, `/dashboard` sem sessão vs. com sessão | ✅ sem sessão → **307** para `/login`; com sessão → **200** (`/chat`, `/dashboard`, `/medicos`, `/perfil`) |
| CI (`.github/workflows/ci.yml`) | lint → typecheck → test → build | ⚠️ **depende do Node** — `scripts/setup-supabase.mjs` e `scripts/ops/*.mjs` exigem Node ≥ 22; o job usa 20 |
| Migrações | — | ✅ **`001→011` completas e validadas em banco limpo (Fase 2.5, 02/10/2026)** — cadeia 11/11 no Postgres 16 Docker, 11 CHECKs e 3 testes de papel OK (`scripts/ops/clean-db-run.log`). No banco vivo: `002→009` + `20261002000001` + **`20261002000002` (Fase 2.6) aplicada no SQL Editor em 02/10/2026** |
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

- ~~Reaplicação das migrações `002`→`005` **num banco limpo** para provar o caminho do zero (Fase 2.5)~~ — **resolvido em 02/10/2026** (ver log abaixo).
- ~~**Aplicação da `20261002000002` (Fase 2.6) no banco vivo**~~ — **aplicada no SQL Editor em 02/10/2026.**
- Jornada completa no navegador (formulários do painel, não só chamadas de API).
- Envio/recebimento real via KOMUNIKA (HMAC, eventos, numeração).
- ~~Disparo dos lembretes fora de `npm run dev`.~~ — **código pronto (Fase 3.1, 02/10/2026):** pg_cron no Supabase + `vercel.json` diário; **falta provar em produção** (ver 7.3).
- **Aplicar `20261002000003` (outbox) e `20261002000004` (cron) no banco vivo** + criar os 2 segredos do Vault (`saudesync_base_url`, `saudesync_cron_token`) e o env `CRON_SECRET` na Vercel — **passos pendentes (não feitos nesta sessão)**.
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

### Fase 1 — Unificar a persistência (P0) — *questão estrutural nº 1* — ✅ 8 de 8 concluídas

- [x] **1.1** **Decisão de arquitetura** — **decidido: Supabase como banco único** (01/10/2026).
- [x] **1.2** Reescrever `src/lib/db.ts` + `src/lib/services/*` sobre `supabaseAdmin` — **feito**: `db.ts` e `multi-tenant.ts` removidos; serviços, auth, lgpd, agente, rotas API, server components e `instrumentation` convertidos para `supabaseAdmin` async.
- [x] **1.3** Eliminar a dependência de `/tmp` — **feito**: o runtime não abre mais `data/saudesync.db` (SQLite só é lido por `scripts/setup-supabase.mjs`).
- [x] **1.4** Definir **uma** fonte para médicos e especialidades — **feito**: tudo lê `professionals` / `specialties` no Supabase.
- [x] **1.5** Remover um dos CRUDs duplicados: alinhar `/api/appointments` × `/api/consultas` (manter um; atualizar `/consultas`). — **feito (01/10/2026):** mantido `/api/appointments` (GET/POST + `[id]` GET/PATCH/PUT/DELETE com janela de 4h, limite de 1 remarcação e `isSlotAvailable`); removidos `src/app/api/consultas/route.ts` e `src/app/api/consultas/[id]/route.ts`. A página `/consultas` já usava `listAppointments()` (server component) e não foi afetada. Consequência: nenhum SELECT do app embute mais `patients` → a `008` deixou de ser bloqueio.
- [x] **1.6** Criar migração **`20260911000001_schema_base.sql`** a partir de `supabase-migration.sql` (ou mover o arquivo para `supabase/migrations/`), para que `supabase db push` funcione do zero. — **feito (02/10/2026):** migration criada (17 tabelas + seed + RLS + revogação de `anon`), `supabase-migration.sql` **removido da raiz**, `20260911000002_rls_fix.backup.sql` movida de `supabase/migrations/` para `data/` e comentários da `003`/`PROGRESSO` apontando para a nova migration. `clinic_members`/`subscriptions`/`usage` já nascem no shape definitivo da `003` (ver linha da tabela 1.8).
- [x] **1.7** `POST /api/pacientes` sem `clinic_id` (coluna `NOT NULL` sem default) e `GET ?phone=` mascarando erro de `single()` como 404. — **feito (01/10/2026):** `clinic_id` resolvido via `getDefaultClinicId()` (ou vindo do corpo) e lookup com `maybeSingle()` — 201/200/404 validados em dev, registro de teste removido.
- [x] **1.8** **Dados do SQLite → Supabase** — **feito (01/10/2026)**: `006`, `007`, `008` e `009` aplicadas, `node scripts/setup-supabase.mjs --apply` executado (161 inseridos / 5 atualizados; reexecução = 0). Preflight com exit 0 e smoke pós-migração: `/dashboard`, `/consultas`, `/api/auth/me`, `/api/appointments`, `/api/stats`, `/api/pacientes`, `/api/clinica`, `/api/especialidades` → **todos 200**.

> **Próximo passo (é onde paramos agora):** Fase 1 **8/8 ✅**, Fase 2 **6/6 ✅**, Fase 3 **7/7 ✅**, Fase 4 **4/4 ✅**, Fase 5 **4/4 ✅** (05/10/2026, sessão 7) e a **Fase 6 está 6/6 ✅** (05/10/2026, sessão 8 — histórico do git varrido sem chaves, `server.log`/backups/`AgenteIA/` removidos, **audit log completo** (migration + service + rota + página), rate limiting em login/signup/webhooks, PII mascarada nos logs, README de backup/LGPD e relatório de retenção executado no banco real; ver log abaixo). **Antes do próximo deploy, 4 pendências manuais:** aplicar `20261005000001_audit_logs.sql` no SQL Editor da Supabase, exigir o status check `quality` na branch protection, **rotacionar as 5 chaves expostas** e confirmar `CRON_SECRET`/Vault. **Restam 6 tarefas (Fase 7) + as pendências manuais.**
> **Próxima fase: Fase 7 — Go-live e aceite do MVP (7.1–7.6).**

### Fase 2 — Auth, tenant e RLS (P0/P1) — ✅ 6 de 6 concluídas

- [x] **2.1** Trocar `src/lib/supabase.ts` (client anônimo sem sessão) por `createBrowserClient` de `@supabase/ssr` em **`src/app/(app)/medicos/page.tsx`** — hoje a página quase certamente lê vazio e não consegue gravar por causa do RLS. — **feito (01/10/2026), em vez do caminho literal:** diagnóstico primeiro mostrou que a **leitura** funcionava com a sessão (anon key + JWT → `clinic_id: 1`, `get_user_clinic_ids()` = `[1]`), mas o **INSERT devolvia `42501`** porque a página não envia `clinic_id` (coluna sem default) e o `WITH CHECK` do `tenant_insert` rejeita. Decisão do produto: seguir pelo caminho dos demais cadastros — criadas `GET/POST /api/professionals` e `PATCH/PUT/DELETE /api/professionals/[id]` sobre `services/doctors.ts` (`supabaseAdmin` + `getDefaultClinicId()`), página reescrita para `fetch`, `email` adicionado a `Doctor`/`DoctorView`/`createDoctor`/`updateDoctor` e o export `supabase` (anon) removido de `src/lib/supabase.ts` (agora só existe `supabaseAdmin`, e nenhum componente de cliente importa Supabase direto). **E2E:** sem sessão → 401; GET → 200 (10 profissionais, com `specialty_name` e agenda); POST → 201; PATCH → 200; DELETE → 200; página `/medicos` → 200.
- [x] **2.2** Aposentar o auth legado: `chat/layout.tsx:5,8` lê o cookie HMAC antigo → **`/chat` está inacessível em produção**. Migrar para `supabase.auth.getUser()` + checagem de papel. — **feito (01/10/2026):** `chat/layout.tsx` agora usa `createClient()` (server) + `getUser()` + papel de `admin_profiles` (RLS de próprio registro) e **liberou para qualquer papel de admin** (decisão de produto: `admin` é o papel real do usuário; antes o gate `super_admin`/`saas_admin` + bypass de dev escondia o problema). `sidebar.tsx` perdeu `superAdminOnly`, `canAccessItem` e o bypass `NODE_ENV===development`; `(app)/layout.tsx` parou de buscar `admin_profiles` só para a sidebar. **`src/lib/auth.ts` e `src/lib/__tests__/auth.test.ts` apagados** (zero consumidores; os testes reimplementavam a lógica em vez de importar o módulo). **E2E:** sem sessão → 307 `/login`; com sessão → `/chat` 200, `/dashboard` 200, `/medicos` 200, `/perfil` 200.
- [x] **2.3** Revisar `proxy.ts`: matcher não cobre `/configuracoes`, `/pacientes` está no matcher mas o redirect checa `/settings` e `/appointments` (rotas que não existem). — **feito (01/10/2026):** lista `PROTECTED_ROUTES` derivada das 9 páginas reais do grupo `(app)`, removidos `/settings` e `/appointments` (não existem), **`/configuracoes` adicionado** (antes `configuracoes/assinatura` passava pelo proxy e só o `layout` fazia a checagem), matcher alinhado à lista e **`/api/:path*` incluído** com comportamento de refresh-only (API nunca redireciona — continua 401 do handler). Checagem de cookie agora aceita **chunks** (`sb-<ref>-auth-token.0`). **Achado corrigido:** o proxy criava o client do Supabase e o descartava (`void supabase`), então o **refresh da sessão era feito e jogado fora** — Server Component não consegue gravar cookie e `/api/auth/me` usa `setAll() {}`; um cookie com `expires_at` no passado devolvia **0 `Set-Cookie`**. Agora o proxy chama `getSession()` (em `try/catch`) e persiste a sessão: mesmo cookie expirado → **`Set-Cookie`** com `expires_at` +60min e o próximo request dá 200. **Teste de regressão:** `src/__tests__/proxy.test.ts` (5 testes) falha se `PROTECTED_ROUTES` e `config.matcher` saírem de sincronia. **E2E:** sem sessão → 307 nas 9 páginas e 200 nas públicas (`/login`, `/precos`, `/agendamento-*`, `/landing`), API sem sessão → 401/200 **nunca** redirect; com sessão → 9/9 páginas 200.
- [x] **2.4** Definir quem usa `service_role` × `anon` × `authenticated`; remover o `GRANT ALL ... TO anon` da migração `004`. — **feito (02/10/2026):**
  - **Mapa de chaves:** `service_role` → só `src/lib/supabase.ts` (`supabaseAdmin`) = todos os `src/lib/services/*`, webhooks e rotas de API (bypassa RLS, só no servidor); `anon` → só Supabase Auth (`/api/auth/*`, `proxy.ts`, `requireAuth`, layouts) — nenhum desses fluxos consulta PostgREST; `authenticated` → só `chat/layout.tsx` lendo `admin_profiles` (RLS de próprio registro). **Nada consulta PostgREST com anon.**
  - `supabase/migrations/20260911000004_grant_permissions.sql` **editada**: os 34 `GRANT ALL ... TO service_role, authenticated, anon` viraram `service_role, authenticated` (o `002` já revogava e o `005` criava policies `USING (false)`, mas a `004` estava concedendo de volta).
  - **Nova** `supabase/migrations/20261002000001_revoke_anon_grants.sql` (idempotente): `REVOKE ALL ... FROM anon` em tabelas + sequences, **`ALTER DEFAULT PRIVILEGES ... REVOKE`** (senão a próxima tabela criada nasce com grant para anon de novo) e 3 consultas de verificação que voltaram **vazias**. Funções não foram mexidas (EXECUTE vem de `PUBLIC`; as 3 do projeto não expõem dado para anon — `get_user_clinic_ids()` usa `auth.uid()`, que é `NULL`).
  - **`src/utils/supabase/client.ts` removido** (`createBrowserClient` sem nenhum consumidor; com anon sem grant de tabela ele não teria uso). O navegador passa a consultar **só via API**.
  - **1ª tentativa no SQL Editor (02/10/2026) falhou na verificação, não no `REVOKE`:** `ERROR: 42809: "objects_bucket_id_name_version_key" is not a sequence`. Causa: o planner reordena os `WHERE` e passou um **índice do schema `storage`** para `has_sequence_privilege()`. Corrigido envolvendo as `has_*` em `CASE WHEN c.relkind = ...`, mais uma 1ª verificação sem risco (`relacl::text LIKE '%anon%'`). `REVOKE` e `ALTER DEFAULT PRIVILEGES` são idempotentes — basta rodar o arquivo de novo.
  - **Executado no SQL Editor (02/10/2026) com sucesso** e **E2E pós-revogação:** consulta `anon` ao PostgREST → **401 `42501 permission denied`** em `patients`, `specialties`, `appointments` e `conversations` (antes `200` + `[]`); login via GoTrue com a anon key → **OK**; app logado → **9/9 páginas 200** e 8 APIs 200 com conteúdo real (`/api/stats`, `/api/especialidades`, `/api/pacientes`, `/api/appointments`, `/api/clinica`, `/api/conversations`, `/api/subscription/limits`, `/api/auth/me`). Nada quebrou: `authenticated` e `service_role` seguem íntegros.
- [x] **2.5** Aplicar/verificar as migrações 002→005 **num banco limpo** e registrar o resultado (log anexado a este documento). — **feito (02/10/2026):** ver "Log da validação em banco limpo" abaixo.
- [x] **2.6** Remover as policies mortas `USING (false)` e corrigir as policies de `doctor_schedule` (apontam para `doctors_legacy`). — **feito (02/10/2026):** nova `supabase/migrations/20261002000002_drop_dead_policies.sql` (idempotente), validada na cadeia limpa: **24 policies mortas removidas**, `ds_tenant_*` de `doctor_schedule` removidas (reapontar para `professionals` é impossível: `doctor_id` BIGINT × `id` UUID; tabela é legada e não é lida pelo app), `*_legacy` portuguesas com RLS habilitado e grants de `anon`/`authenticated` revogados. **Aplicada no SQL Editor do banco vivo em 02/10/2026.**

### Log — validação em banco limpo (Fase 2.5, 02/10/2026)

**Como rodar:** `node scripts/ops/clean-db-test.mjs` (opcional `--keep` para manter o container). Requisitos: Docker rodando + imagem `postgres:16`. **Log completo: `scripts/ops/clean-db-run.log`.**

**O que o script faz:** sobe um Postgres 16 descartável → aplica `scripts/ops/clean-db-bootstrap.sql` (roles `anon`/`authenticated`/`service_role` NOLOGIN, `service_role` **BYPASSRLS**, schema `auth` com `auth.users` vazio + `auth.uid()`, e `ALTER DEFAULT PRIVILEGES` iguais aos do Supabase — é o que a `010` precisa revogar) → roda as **11 migrations** de `supabase/migrations/` em ordem com `ON_ERROR_STOP=1` → `scripts/ops/clean-db-verify.sql` (**11 CHECKs**) → **3 testes de papel**.

**RESULTADO: CADEIA ÍNTEGRA — 11/11 migrations · 11/11 CHECKs · 3/3 testes de papel · exit 0 (7,4 s).**

| Etapa | Resultado |
|---|---|
| `001 schema_base` (nova) | ok — 17 tabelas, seed 1 clínica, policies de isolamento, `anon` revogado |
| `002 rls_fix` | ok — `clinic_id` "já existe" ×8; bridge `clinic_members.admin_id` **pulado**; índice `admin_id` **pulado** (guards da 2.5) |
| `003 schema_definitivo` | ok — DML PT→EN (seções 2.1–2.5) **pulado** com NOTICE (tabelas fonte inexistentes); `clinic_members`/`subscriptions`/`usage` já no shape definitivo (`IF NOT EXISTS` no-op); `doctors`→`doctors_legacy` |
| `004 grant_permissions` | ok — 5 grants pulados com NOTICE (`doctors` já renomeada + 4 `*_legacy`) |
| `005 auth_rls` | ok — `get_user_clinic_ids()`, `tenant_*`, `cm_own_*`, `*_own_*`, `messages_tenant_*` |
| `006`–`009` | ok — FKs de embedding; `009` sem admins legados (0 vinculados / 0 pendentes) |
| `010 revoke_anon` | ok — as 3 consultas de verificação voltaram **vazias** |
| `20261002000002` (2.6) | ok — **24 policies mortas removidas** (17 `*_isolation` + 6 `anon_blocked` + `api_access_log_block`); inventário final **71 policies** |
| Verificação (11 CHECKs) | seed; RLS em **24/24** tabelas; **0** policies `USING (false)`; **0** policies em `doctor_schedule`; `anon` sem privilégio algum; nenhuma ACL cita `anon`; **12 FKs** obrigatórias; **5** índices únicos; shape definitivo (`clinic_members.user_id` uuid sem `admin_id`; `usage`/`subscriptions` PK uuid; `subscriptions.cancelled_at`); `doctors_legacy` existe e `doctors` não; funções `get_user_clinic_ids()`/`update_updated_at_column()` |
| Testes de papel | `anon` → **permission denied** em `clinics`; `authenticated` → **0 linhas** em `clinics`/`patients`/`admin_profiles` (RLS); `service_role` → **1 clínica** (BYPASSRLS) |

**Achados e decisões registrados:**

1. **Três bloqueios do caminho limpo foram corrigidos com guards** (sem efeito no banco vivo, que já passou por essas migrations): `002` FASE 3/4 (coluna `admin_id` só existe no shape antigo), `003` FASE 2 inteira (DML lê tabelas Portuguese que nunca existiram num banco novo) e `004` (grants em tabelas renomeadas/inexistentes). Todos pulam com `RAISE NOTICE` em vez de abortar.
2. **Banco vivo não expõe `clinic_units` nem `api_access_log`** (probe PostgREST da sessão anterior, `PGRST205`); em banco limpo ambas existem (criadas por `001`/`002`) e ficam deny-all. Inofensivo: nenhum código do app as lê.
3. **`idx_usage_clinic_period` sai não-única** — a `002` cria o índice comum antes de a `003` tentar o `CREATE UNIQUE INDEX IF NOT EXISTS` de mesmo nome. É o mesmo estado provável do banco vivo. Unicidade de `(clinic_id, period)` vira item de backlog se o upsert de uso precisar dela.
4. **Idempotência por migration:** `002` e `004` ficaram reexecutáveis (guards); `003`, `005` e as policies da `001`/`002` **continuam não idempotentes** (`ADD CONSTRAINT`/`CREATE POLICY` sem guarda) — em banco vivo não se reexecuta; caminho de banco novo é a cadeia limpa.

---

### Fase 3 — Confiabilidade do agente e regras de negócio (P0/P1) — ✅ 7 de 7 concluídas

- [x] **3.1** **Lembretes em produção (P0):** criar `vercel.json` com cron apontando para `POST /api/reminders/run` (já pronto e protegido por `INTERNAL_API_TOKEN`), ou migrar para uma Edge/Supabase cron. Manter o `setInterval` apenas como fallback em dev. — **feito (02/10/2026, sessão 4):** caminho escolhido = **agendador primário pg_cron + pg_net + vault no Supabase** (migração `20261002000004`, 3 jobs: `saudesync_reminders` 5 min, `saudesync_outbox` 2–57/5 min, `saudesync_cycle` diário 02:43 UTC — o comando HTTP pula com segurança se o Vault não tiver segredos), porque a Vercel Hobby só aceita cron ≥1x/dia; `vercel.json` traz 3 crons **diários** como fallback de cobertura (guardado por teste — se alguém virar para 5 min, o deploy falha no Hobby); `setInterval` do `reminder-scheduler.ts` roda **só em dev** (desligado com log quando `VERCEL`/`NODE_ENV=production`); `requireInternalAuth` aceita `INTERNAL_API_TOKEN` **ou** `CRON_SECRET`; rotas `GET|POST /api/reminders/run` e novas `POST /api/outbox/run` e `POST /api/subscription/cycle/run` com `force-dynamic`.
- [x] **3.2** **Idempotência dos lembretes:** `UNIQUE (appointment_id, type)` + `INSERT ... ON CONFLICT DO NOTHING`. — **feito (02/10/2026):** índice `uq_reminders_appointment_type` (migration 006) + `sendReminder` vira `upsert` com `ignoreDuplicates:true` e `.select("id")`; fila vazia (RLS/exclusão) → delete do registro para a próxima tentativa recriar; `runReminderCheck` conta só envios reais (`{sent}` = fila criada) e chama `processOutboxInBackground()`.
- [x] **3.3** **Concorrência de horário (P0):** `UNIQUE (doctor_id, starts_at)` (ou lock transacional) + tratamento de erro amigável devolvendo "horário acabou de ser ocupado" e oferecendo o próximo. — **feito (02/10/2026):** índice `uq_appointments_professional_start` (migration 006) é a trava; `appointments.ts` exporta `SlotTakenError` (`code:"SLOT_TAKEN"`, msg PT) + `isUniqueViolation(23505)`; aplicado no insert, no `reschedule` (pre-check + update) e no catch da rota `POST /api/appointments` → **409 `{error, code:"SLOT_TAKEN"}`**; `PATCH /api/appointments/[id]` idem; no agente, `book_appointment` chama `slotTakenWithAlternatives()` (chama `getAvailableSlots`, devolve até 3 alternativas na resposta da tool), `reschedule_appointment` devolve hint para o LLM chamar `get_availability`.
- [x] **3.4** **Fila de mensagens do WhatsApp (P0):** tabela `outbox` + reprocessamento; o webhook deve devolver `5xx` em erro fatal para que a KOMUNIKA reenvie (hoje devolve `200`). — **feito (02/10/2026):** migration `20261002000003` (BIGSERIAL, status `pending/sending/sent/failed` com CHECK, índices parciais, RLS sem policies, `REVOKE FROM anon`); `src/lib/services/outbox.ts` — `enqueueOutboxMessage()`, `processOutbox()` com claim por UPDATE condicionado (inclui recuperação de `sending` preso >15 min), backoff `[1,5,15,60,240]` min até `OUTBOX_MAX_ATTEMPTS=5`, `PERMANENT_HTTP_STATUS = {400,401,403,404,422}` (falha reprocessável → 5xx para a KOMUNIKA reenviar; 4xx permanente → `failed` sem loop); webhook passa a **enfileirar** (`chat_reply`/`transfer_notice`) em vez de enviar direto e o `catch` externo devolve **500** (antes 200 silencioso); rota `POST /api/outbox/run` dispara o processador (cron de 5 min).
- [x] **3.5** **Transferência real (P0):** ler `conversation.status` no início de `handlePatientMessage` e **encerrar a participação da IA** (`transferred`/`WAITING_HUMAN_INTERVENTION`); não continuar o loop após `transfer_to_human`; notificar a recepção com o histórico. — **feito (02/10/2026):** novo `src/lib/services/transfers.ts` (`HUMAN_TRANSFER_NOTICE`, `TRANSFER_WAITING_REPLY`, `notifyReceptionTransfer()` → `createNotification type:"transfer"` com as últimas 10 mensagens); `agent.ts` — guarda `transferred` no início (grava msg e devolve `TRANSFER_WAITING_REPLY` **sem chamar a LLM**, `transferred:false` no callback), guarda `WAITING_HUMAN_INTERVENTION` (retoma com status "open" se `hasAiQuota()`, senão repete o aviso de cota), no tool loop: `updateConversation(transferred)` + `notifyReceptionTransfer()` + `if (transferred) break;` (quebra imediata, sem passar por tools seguintes nem LLM de novo) e o pós-loop devolve `HUMAN_TRANSFER_NOTICE` com `transferred:true`; webhook `transfer_to_human` enfileira `transfer_notice` ou usa `reply` (elimina duplo-envio); painel de notificações ganha tipo "Transferência" (ícone `UserCheck`).
- [x] **3.6** Fechar as regras que faltam: horário de funcionamento no agendamento do mesmo dia; corte das 4h para remarcar/cancelar só via humano; liberação de horário em no-show; `consultation_duration` no lugar do passo fixo de 30 min. — **feito (05/10/2026, sessão 5):**
  - **Horário de funcionamento:** `OutsideHoursError` (`code:"OUTSIDE_HOURS"`) + regra pura `checkWithinWorkingHours(schedule, startsAt, endsAt)`; `assertWithinWorkingHours()` roda no `createAppointment` e no `rescheduleAppointment` (recusa horário no passado e qualquer janela fora do expediente — inclusive o agendamento do mesmo dia, em que o LLM pode inventar um horário que a listagem nunca mostrou). Agenda **vazia** = sem dados → não valida (comportamento manual preservado); agenda existe mas não atende no dia → recusa. `POST /api/appointments` e `PUT /api/appointments/[id]` devolvem **400 `{code:"OUTSIDE_HOURS"}`**; no agente, `book_appointment`/`reschedule_appointment` caem em `slotUnavailableResult()` com até 3 alternativas reais.
  - **Corte das 4h ⇒ só humano:** `canCancel`/`canReschedule` agora devolvem `RuleCheck` com **`requiresHuman: true`** nas violações de janela (4h) e de limite (1 remarcação) — e *sem* essa flag quando a consulta simplesmente não está ativa. No tool, a checagem roda **antes** da execução e devolve `{"requires_human": true, hint: "…chame transfer_to_human"}`; o `cancelAppointment`/`rescheduleAppointment` do serviço continua sendo a trava de verdade.
  - **Liberação em no-show:** novo status **`no_show`** (`AppointmentStatus`); `isNoShowDue()` (grace de **30 min**), `markNoShow()` (manual, via `PATCH {status:"no_show"}`) e `releaseNoShowAppointments()` (varredura que converte `scheduled` vencido → `no_show`). Como todos os busy windows/conflitos/listagens já filtram `status=scheduled`, **marcar no-show libera o horário automaticamente**. Varredura roda no cron de 5 min (`/api/reminders/run` devolve `{sent, released}`) e no `tick()` do scheduler em dev. Badges "Não compareceu" em consultas, dashboard, `appointments-list` e `animated-table-rows`.
  - **Passo dos slots:** o `cursor = addMinutes(cursor, 30)` virou `durationMinutes` — extraído `enumerateSlots()` (regra pura) do `getAvailableSlots`; agenda de 60 min agora gera 08:00, 09:00… e não 08:00, 08:30.
- [x] **3.7** Cancelamento/remarcação com confirmação explícita em duas etapas. — **feito (05/10/2026, sessão 5):** `cancel_appointment` e `reschedule_appointment` ganharam o parâmetro opcional **`confirm`** e agora têm 3 etapas: **(0)** valida as regras de negócio (`canCancel`/`canReschedule`) e, se `requires_human`, devolve o motivo para transferir; **(1)** sem `confirm=true` devolve `{"needs_confirmation": true, summary, message}` pedindo que o LLM pergunte "Sim/Não" explicitamente — **não executa nada**; **(2)** com `confirm=true` executa de fato (com `SlotTakenError`/`OutsideHoursError` tratados). System prompt (`prompts.ts`) reescrito no passo 7 descrevendo as duas etapas e ganhou 2 regras: nunca `confirm=true` sem confirmação inequívoca e agendar só dentro do expediente (sempre via `get_availability`).

### Log — Fase 3.1–3.5 (sessão 4, 02/10/2026)

**Decisão de plataforma (3.1):** o usuário informou "não sei / verificar depois" sobre o plano da Vercel → implementado caminho que funciona em **qualquer plano**: **pg_cron + pg_net + Vault do Supabase são o agendador primário** (o banco agenda a si mesmo a cada 5 min); `vercel.json` fica só com 3 crons **diários** (no Hobby, qualquer expressão mais frequente que 1x/dia derruba o deploy — há teste unitário impedindo regressão). O `setInterval` do `instrumentation.ts` continua existindo mas só em dev.

**Migrations novas (idempotentes, APLICAR NO SQL EDITOR DO BANCO VIVO — ainda não aplicadas):**

1. `supabase/migrations/20261002000003_outbox.sql` — tabela `outbox` (BIGSERIAL, `text` com formato `YYYY-MM-DD HH24:MI`, CHECK de status, índices parciais `pending`/`sending` obsoletos, RLS habilitada **sem policies** = deny-all para anon/authenticated, `REVOKE ... FROM anon`).
2. `supabase/migrations/20261002000004_cron_supabase.sql` — habilita `pg_cron`/`pg_net`/`pgcrypto` se disponíveis (guardas via `pg_available_extensions` + `to_regprocedure`/`to_regclass`), cria os 3 jobs com comando SQL gerado por `format` que lê os segredos do Vault a cada execução e **pula o HTTP com silêncio se `saudesync_base_url` estiver vazia**; sem extensão, só `RAISE NOTICE` (cadeia limpa continua verde).

**Configuração pós-deploy (uma única vez, SQL Editor + Vercel):**

```sql
SELECT vault.create_secret('https://SEU-APP.vercel.app', 'saudesync_base_url');
SELECT vault.create_secret('SEU_TOKEN_ALEATORIO_LONGO', 'saudesync_cron_token');
-- conferir:
SELECT jobname, schedule FROM cron.job ORDER BY jobname;
```

- O token do Vault **deve ser igual** ao env **`CRON_SECRET`** da Vercel (`requireInternalAuth` aceita ele ou `INTERNAL_API_TOKEN`; sem token configurado as rotas respondem 500/401 e os jobs pulam).
- Verificação do agendador (depois de 5–10 min): `SELECT jobid, status, return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;` e, no app, `SELECT status, count(*) FROM outbox GROUP BY 1;` + `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;`.

**Arquivos alterados/criados:** `vercel.json` (novo); `src/lib/services/outbox.ts` (novo); `src/lib/services/transfers.ts` (novo); `src/app/api/outbox/run/route.ts` e `src/app/api/subscription/cycle/run/route.ts` (novos); `src/lib/__tests__/fase3.test.ts` (novo, 12 testes); `supabase/migrations/20261002000003_outbox.sql` e `20261002000004_cron_supabase.sql` (novos); editados `src/lib/api-auth.ts`, `src/lib/services/reminders.ts`, `src/lib/services/appointments.ts`, `src/lib/services/reminder-scheduler.ts`, `src/lib/agent/agent.ts`, `src/lib/agent/tools.ts`, `src/app/api/webhooks/komunika/route.ts`, `src/app/api/reminders/run/route.ts`, `src/app/api/appointments/route.ts`, `src/app/api/appointments/[id]/route.ts`, `src/lib/types.ts` (`NotificationType` + `"transfer"`), `src/components/.../notification-panel.tsx`, `src/instrumentation.ts` (comentário).

**Validação executada:** `eslint` 0/0 · `tsc --noEmit` ✅ · `vitest` **50/50** (4 arquivos) · `next build` ✅ (exit 0, rotas novas presentes) · cadeia limpa `clean-db-test.mjs` **13/13 migrations · 11/11 CHECKs · 3/3 testes de papel · exit 0** (a `000004` degrada com NOTICE no Docker, como projetado) · **caminho de agendamento do cron validado isoladamente** com stubs de `cron`/`vault`/`net` num Postgres 16 limpo: 3 jobs criados com os schedules corretos, reexecução da migration idempotente (segue 3 jobs, não 6), o SQL gerado do job executa com `EXECUTE` sem erro e sem `base_url` o comando não faz chamada.

**Limitações registradas (backlog):** o `claim` do outbox é um UPDATE condicionado (race aceitável com execução única por cron; se duas instâncias rodarem ao mesmo tempo, só uma reivindica a linha); a mensagem *inbound* do WhatsApp que falhar no processamento assíncrono de background não é re-puxada pela KOMUNIKA (a resposta, que é o que importa para o usuário, já está em fila); backoff único por linha (`next_attempt_at`), sem cronologia por destinatário.

### Log — Fase 3.6–3.7 (sessão 5, 05/10/2026)

**Arquitetura das regras:** tudo que é regra de negócio virou **função pura testável** (`checkWithinWorkingHours`, `enumerateSlots`, `isNoShowDue`, `canCancel`/`canReschedule` com `RuleCheck`), e o serviço (API + agente) é só o invocador — a trava real continua no `createAppointment`/`rescheduleAppointment`/`cancelAppointment`, nunca só no prompt.

**Arquivos alterados:** `src/lib/services/appointments.ts` (erros `OutsideHoursError`, regras `RuleCheck`, no-show, `enumerateSlots`), `src/lib/agent/tools.ts` (3 etapas em cancel/remarca, `slotUnavailableResult`, `humanOnly`, `confirmationPending`), `src/lib/agent/prompts.ts` (passo 7 reescrito + 2 regras novas), `src/lib/types.ts` (`AppointmentStatus` + `no_show`), `src/app/api/appointments/route.ts` e `[id]/route.ts` (400 `OUTSIDE_HOURS`, `PATCH status:"no_show"`), `src/app/api/reminders/run/route.ts` e `src/lib/services/reminder-scheduler.ts` (varredura de no-show), `src/lib/__tests__/fase3-regras.test.ts` (**novo, 26 testes**), badges em `consultas/page.tsx`, `dashboard/page.tsx`, `appointments-list.tsx`, `animated-table-rows.tsx`.

**Validação executada:** `eslint` 0/0 · `tsc --noEmit` ✅ · `vitest` **76/76** (5 arquivos) · `next build` ✅ (exit 0).

**Limitações registradas (backlog):** (1) profissional com `schedule` **vazio** não passa por validação de expediente (não há dados; agenda manual preservada); (2) a duas etapas é **estrutural na tool** (não executa sem `confirm=true`), mas quem atesta que o paciente disse "sim" é o LLM — se virar problema, guardar `pending_action` na conversa e conferir a última mensagem do paciente; (3) no-show não gera notificação para a recepção nem para o profissional; (4) a varredura de no-show só retroage 30 min por execução (se o cron ficar dias parado, conversões antigas ficam `scheduled` até a próxima execução).


### Fase 4 — Dashboard e dados (P1) — ✅ 4 de 4 concluídas

- [x] **4.1** Exibir `conversionRate` (já calculado) e corrigir "Consultas Hoje" (`stats.ts:40` sem filtro de data) e "Total de pacientes" (`stats.ts:46` deve ler a tabela de pacientes). — **feito (05/10/2026, sessão 6):** `getStats()` ganhou `todayScheduled` / `todayCancelled` / `todayRescheduled` (contagens `head` com `starts_at` no intervalo do dia); "Consultas Hoje" deixou de exibir `scheduled` (total geral, sem filtro de data) e passou a mostrar os 3 números do dia — sub-linha "X canceladas · Y remarcadas", o que também fecha do PRD "consultas canceladas/remarcadas" no painel; `totalPatients` agora conta a tabela **`patients`** (`countQuery("patients")`) em vez de nomes distintos de `appointments`; novo KPI **"Conversão IA"** com `conversionRate` (taxa de conversas → consultas do PRD) e grade `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
- [x] **4.2** Introduzir o estado "pedido pendente" real (ou renomear o card — hoje ele só reexibe consultas de hoje). — **feito (05/10/2026, sessão 6):** `pendingRequests` deixou de ler `appointments` do dia (duplicata da Agenda) e passou a ler **`conversations` com `status IN ('transferred','WAITING_HUMAN_INTERVENTION')`**, últimas 5 por `updated_at` — o estado real em que a IA saiu do atendimento (Fase 3.5). Card renomeado **"Solicitações" → "Aguardando atendimento"** (subtítulo "A IA parou de responder"), exibindo nome/paciente sem nome, telefone, "atualizada hoje às HH:MM" e badge **Transferida** / **Cota esgotada**.
- [x] **4.3** Alimentar `pendingRequests`/`totalPatients` sem engolir erro silenciosamente (`safeCount`/`safeAll` viram `0` em falha de banco). — **feito (05/10/2026, sessão 6):** `DashboardStats` ganhou **`errors: string[]`**; cada contagem (`countRun`) e cada loader registra o rótulo do escopo que falhou além do `console.warn` (ex.: "pacientes", "agenda de hoje", "conversas aguardando humano") e devolve `0`/`[]` **com a falha reportada**; o dashboard renderiza um banner `role="alert"` ("Alguns indicadores não puderam ser carregados: … os valores exibidos podem estar incompletos"). Exceção em `getStats()` também vira banner em vez de zeros silenciosos. **`safeCount`/`safeAll` não existem mais** — a variante atual é `countRun(run, scope, label, errors)`.
- [x] **4.4** Definir destino dos componentes órfãos (8 arquivos) e das rotas sem consumidor. — **feito (05/10/2026, sessão 6):**
  - **Removidos 6 componentes:** `dashboard/kpi-card`, `dashboard/appointments-list`, `dashboard/doctor-status-list`, `dashboard/appointment-requests-card`, `animated-table-rows`, `animated-entry` — 0 consumidores e legados do layout "neon" anterior (o dashboard renderiza esses mesmos blocos inline no tema atual; `skeleton.tsx`/`error.tsx` seguem usando `neon-card`).
  - **Mantidos 2 (congelados):** `subscription-panel` e `subscription/upgrade-modal` — são os únicos consumidores de `GET /api/subscription` e `POST /api/subscription/buy-overage-pack` e dependem da **decisão de produto nº 4** (manter ou congelar assinatura); apagar agora descartaria a única UI de compra de pacote de excesso.
  - **Rotas sem consumidor: destino definido, nenhuma removida** — `/api/appointments` + `[id]` = CRUD único com as regras do PRD (Fase 1.5, usado por Integração/extensão futura; a página `/consultas` lê via `listAppointments()`); `/api/stats` e `/api/conversations` = APIs de leitura para integração/observabilidade (**`/api/conversations` é o caminho natural da caixa de entrada humana**, consumidor previsto do estado da 4.2 — backlog); `/api/pacientes/[id]` = CRUD completo sem UI (a página só lista e cria); `/api/subscription` + `{limits,usage,checkout,buy-overage-pack}` = superfície de cobrança **congelada pós-MVP** (decisão nº 4), exceto `/plan` que a página de assinatura consome; `/api/integrations/komunika/setup` = setup manual (curl/token); `/api/health` = monitoramento externo; `/api/webhooks/*` = chamados pela Komunika/LOJOU; `reminders|outbox|subscription/cycle/run` = cron (`vercel.json` + pg_cron). **Correção do grep original:** `/api/chat/history`, `/api/notifications/[id]`, `/api/especialidades/[id]` **são** consumidos pela UI (estavam listados como órfãos por casar só com o prefixo literal).

### Log - Fase 4 (sessão 6, 05/10/2026)

**Arquivos alterados:** `src/lib/services/stats.ts` (novos campos `todayScheduled`/`todayCancelled`/`todayRescheduled`/`errors`, `totalPatients` via tabela `patients`, `loadPendingRequests` reescrito para `conversations`, `countRun(run, scope, label, errors)`, `countDistinctPatients` removido); `src/app/(app)/dashboard/page.tsx` (KPI "Conversão IA", sub-linha de canceladas/remarcadas do dia, banner de erros, card "Aguardando atendimento", grade de 5 KPIs); **removidos** 6 componentes órfãos (ver 4.4); **novo** `src/lib/__tests__/stats.test.ts` (3 testes).

**Validação executada:** `eslint` 0/0 · `tsc --noEmit` ✅ · `vitest` **79/79** (6 arquivos, +3 em `stats.test.ts`) · `next build` ✅ (exit 0).

**Limitações registradas (backlog):** (1) ainda **não existe UI para responder** a conversa transferida — o card mostra o pendente e o telefone, mas a caixa de entrada humana (provavelmente sobre `/api/conversations` + `/chat` com papel de atendente, hoje `/chat` envia como *paciente* pelo agente) não foi construída; (2) contagens do dia dependem de `starts_at` em texto `YYYY-MM-DD HH:MM` (mesmo formato já usado pela Agenda) — se a coluna virar `timestamptz` puro, revisar a janela; (3) `errors` cobre falha de leitura por escopo, não "nenhum dado" (lista vazia ≠ erro); (4) os 2 componentes de assinatura congelados continuam órfãos até a decisão de produto nº 4; (5) `/api/stats` devolve o mesmo `getStats()` — se um integrante externo passar a consumi-lo, o payload agora inclui `errors`.

### Fase 5 — Qualidade e CI (P0 para merge) — ✅ 4 de 4 concluídas

- [x] **5.1** Zerar os **36 erros** de ESLint (20 `set-state-in-effect`, 8 `error-boundaries`, 8 `no-require-imports`) — **feito em 01/10/2026** (`eslint` agora 0 erros / 0 warnings).
- [x] **5.2** CI: trocar Node 20 → 22/24 (hoje o job de build quebraria por `node:sqlite`) e alinhar `README` ("Node 20.9+"), `.node-version` e `engines`. — **feito (05/10/2026, sessão 7):** `ci.yml` passou de `node-version: "20"` → **`"22"`** nos dois jobs (`quality` e `build`); `README.md` agora diz **"Node.js 22+ (testado com Node 24; `engines`, `.node-version` e CI usam 22)"** e as seções `Estrutura`/`Banco de dados` — que ainda afirmavam "o MVP usa `node:sqlite`" e `data/saudesync.db` — foram corrigidas para **Supabase (Postgres + Auth)**. `.node-version` (22) e `engines` (`>=22`) já estavam corretos; nenhuma alteração.
- [x] **5.3** Alçar cobertura: testes de regras de negócio (`appointments`: 4h/1 remarcação/2h), do agente (loop, transferência, quota), do scheduler de lembretes **e do fluxo real de login/signup** (a Fase 2.2 apagou os 9 do auth legado). Hoje 33 testes cobrem apenas sanitização e HMAC de webhook. — **feito (05/10/2026, sessão 7):** as **regras de `appointments`** já estavam cobertas pela Fase 3 (`fase3-regras.test.ts`: 4h, limite de 1 remarcação, slots por duração, no-show — auditado aqui); entraram **3 arquivos novos, +24 testes**:
  - `src/lib/__tests__/agent.test.ts` (**9**) — resposta direta + consumo de tokens, tool call → resposta na iteração seguinte, **limite de 8 iterações com fallback** (sem loop infinito), `transfer_to_human` encerra o loop e notifica a recepção, **cota esgotada bloqueia antes do LLM** e marca `WAITING_HUMAN_INTERVENTION`, conversa `transferred` roda **sem chamar o LLM**, retomada quando a cota volta, erro do LLM vira mensagem (não exceção) e ausência de `OPENAI_API_KEY`.
  - `src/lib/__tests__/scheduler.test.ts` (**4**) — tick imediato com as 4 tarefas + `setInterval` de 60s em dev, idempotência (não duplica), **produção/Vercel não agenda nada** (deixa o pg_cron no comando) e falha de tarefa reportada sem derrubar o tick.
  - `src/__tests__/auth-flows.test.ts` (**11**) — login: 400 (campos), 401 (GoTrue), 403 `PROFILE_MISSING`, 403 `CLINIC_MISSING`, **200 sem clínica para papel de plataforma**, 200 feliz normalizando o e-mail (`"  Admin@Clinica.COM "` → `admin@clinica.com`); signup: 400 (campos), 400 (senha < 8), 409 (e-mail existente), **201 com a ordem exata `profiles → admin_profiles → clinics → clinic_members`** e **rollback em ordem inversa + `deleteUser`** quando `clinic_members` falha.
  - **Total: 103 testes / 9 arquivos** (era 76/6; +27 na sessão).
- [x] **5.4** Ligar `test:coverage`/status check obrigatório no GitHub. — **feito (05/10/2026, sessão 7):** o job `quality` do CI roda **`npm run test:coverage`** (era `vitest run --reporter=verbose`), então cobertura e thresholds viram **status check de todo push/PR**; `vitest.config.ts` ganhou `coverage.thresholds` no baseline medido (18.8/9.1/19.6/20.1 stmt/branch/func/lines → gates **17/8/18/19**, com ~1pt de folga para a variação do v8 entre Node 22 e 24) e o reporter `lcov`; `coverage/` já era gitignored e entrou no `globalIgnores` do ESLint. **Pendência manual:** exigir o check na branch protection (`Settings → Branches → main → Require status checks` — job `quality`) — não há `gh`/token nesta sessão para fazer via API.

### Log - Fase 5 (sessão 7, 05/10/2026)

**Arquivos alterados/criados:** `.github/workflows/ci.yml` (Node 22 + `npm run test:coverage`), `README.md` (Node 22+, seções de estrutura/banco corrigidas para Supabase), `vitest.config.ts` (thresholds + reporter `lcov`), `eslint.config.mjs` (`coverage/**` ignorado), **novos** `src/lib/__tests__/agent.test.ts`, `src/lib/__tests__/scheduler.test.ts` e `src/__tests__/auth-flows.test.ts`.

**Validação executada:** `eslint` 0/0 · `tsc --noEmit` ✅ · `vitest` **103/103** (9 arquivos) · `test:coverage` ✅ **exit 0** com thresholds · `next build` ✅ (exit 0).

**Cobertura global hoje (v8, `src/lib/**`):** statements 18.8% · branches 9.1% · functions 19.6% · lines 20.1% — gates da CI em 17/8/18/19.

**Limitações registradas (backlog):** (1) **exigir o status check na branch protection continua manual** (sem `gh`/token nesta sessão); (2) a cobertura global é baixa porque os services de banco (`reminders`, `conversations`, `plan-limits`, `komunika`, `subscriptions`) seguem sem teste direto — os gates são globais e foram calibrados no baseline, então só sobem; (3) `tools.ts` (22%) só é exercitada indiretamente pelo `agent.test.ts` e `llm.ts`/`prompts.ts` ficam **mockados** (nenhuma chamada real de rede em teste); (4) login/signup testam a **lógica da rota** com Supabase mockado — a integração real com GoTrue/RLS continua para o E2E da Fase 7.2.

### Fase 6 — Segurança e operação (P0/P1) — ✅ 6 de 6 concluídas

- [x] **6.1** Rotacionar as cinco chaves obrigatórias (ver aviso ao final) e verificar que **não** estão em nenhum ponto do histórico do git (`.env` nunca foi versionado — confirmado — mas `server.log` está versionado e deve ser revisado/removido). — **feito (05/10/2026, sessão 8):** varredura do **histórico inteiro (90 commits)** com `git grep` nos padrões de valor (chaves `sk-…`, JWT `eyJ…`, `OPENAI_API_KEY=`/`SUPABASE_SERVICE_ROLE_KEY=`/`KOMUNIKA_*=`/`LOJOU_*=`/`CRON_SECRET=`) → **nenhuma ocorrência**; `git log --diff-filter=A` prova que `.env`/`.env.local` **nunca** entraram no git; `server.log` revisado (26 linhas, só acesso do dev server, sem segredos, única versão = commit inicial) e **removido do git e do disco** + `*.log` no `.gitignore`. **Rotação das 5 chaves continua manual** (painel da OpenAI/Komunika/Supabase/Lojou + Vercel).
- [x] **6.2** Remover senha fixa dos `scripts/` e restringir `INTERNAL_API_TOKEN`. — **feito (05/10/2026, sessão 8):** auditoria dos 7 scripts (`*.mjs`) → **nenhuma senha fixa**: todos exigem `OPS_ADMIN_EMAIL`/`OPS_ADMIN_PASSWORD` do `.env` (senha gerada por `randomBytes` no `fix-auth-user.mjs`); o `admin/admin123` que sobrou saiu do **README** (linha de "Acesso inicial" agora descreve signup + `scripts/ops/README.md`); `requireInternalAuth` **perdeu o bypass de dev** — sem `CRON_SECRET`/`INTERNAL_API_TOKEN` a rota interna responde **500 em qualquer ambiente** (antes: fora da Vercel liberava sem token); `src/lib/db.ts.backup` (continha `hashSync("admin123", 10)`) apagado.
- [x] **6.3** Audit log de atividades (exigência do PRD, hoje inexistente). — **feito (05/10/2026, sessão 8):** migration **`20261005000001_audit_logs.sql`** (`clinic_id` FK, `actor_id`/`actor_label` (e-mail **mascarado**), `action`, `entity`, `entity_id`, `meta jsonb`, `ip`, `created_at`; RLS **deny-all** + `REVOKE` do anon; índices `clinic_id+created_at` e `action`); serviço **`src/lib/services/audit.ts`** (`recordAudit` best-effort — nunca derruba a operação, `auditRequest` resolve a sessão e o IP, `listAuditLogs` com clamp 1..500); rota **`GET /api/audit`** (atrás de `requireAuth`); página **`Configurações → Auditoria`** (tabela com ação/ator/entidade/detalhes/IP) + link na sidebar (desktop e mobile). Eventos gravados: `auth.login`, `auth.login_failed`, `auth.login_blocked` (PROFILE/CLINIC_MISSING), `auth.signup`, `appointment.create/cancel/no_show/completed/reschedule`, `patient.create`, `professional.create/update/delete` (meta guarda só os **campos** alterados), `specialty.create/update/delete`, `clinic.update`. Teste novo `src/lib/__tests__/audit.test.ts`. **Validação:** cadeia de **14 migrations em banco limpo com Docker** (`clean-db-test.mjs`, exit 0, `audit_logs` com RLS confirmado). **Pendência manual:** aplicar a migration no SQL Editor da Supabase de produção antes do deploy.
- [x] **6.4** Backup e restauração documentados + retenção LGPD verificada com dados reais. — **feito (05/10/2026, sessão 8):** README ganhou as seções **"Backup e restauração"** (PITR/snapshots do Supabase, `pg_dump -Fc` diário, `pg_restore --clean --if-exists`, dump cobre `public`+`auth`, segredos ficam fora do dump, drill trimestral) e **"Privacidade (LGPD)"** (políticas 90/365/30 dias via `instrumentation.ts`); criado **`scripts/ops/lgpd-retention-report.mjs`** (somente leitura) e **executado contra o banco real**: 138 mensagens / 9 conversas / 0 usuários → **0 linhas dentro das janelas de retenção hoje** (dados recentes; relatório sai com exit 0 e não escreve nada).
- [x] **6.5** Remover `db.ts.backup`, `supabase-migration.backup.sql`, `*.backup.sql` e a cópia não versionada `AgenteIA/` (ou versioná-la como artefato deliberado). — **feito (05/10/2026, sessão 8):** apagados `src/lib/db.ts.backup`, `supabase-migration.backup.sql` e `data/20260911000002_rls_fix.backup.sql` (conteúdo preservado no histórico do git); **`AgenteIA/` removida** (181 arquivos) — antes de apagar, os **20 arquivos que só existiam lá** foram conferidos um a um com `git log --all -- <path>`: **todos existem no histórico**, logo nada de único foi perdido. `scripts/ops/clean-db-run.log` segue versionado de propósito (evidência da Fase 2.5/6.3 referenciada no PROGRESSO; regenerável com o script).
- [x] **6.6** Rate limiting/anti-Abuse no webhook e nas rotas de auth; mascarar PII nos logs. — **feito (05/10/2026, sessão 8):** novo **`src/lib/rate-limit.ts`** (janela deslizante em memória, buckets com sweep, `clientIp` via `x-forwarded-for`, `tooManyRequests` com `Retry-After`, `resetRateLimits` p/ testes) aplicado a **`login`** (30/5 min por IP + 10/5 min por e-mail), **`signup`** (10/h por IP), **`webhooks/komunika`** e **`webhooks/lojou`** (60/min por IP, **antes** de ler o corpo). PII nos logs: e-mail cru do Lojou → `maskEmail`, `JSON.stringify(erro)` do `auth/email` → só código+mensagem, JSON parse do webhook **não loga mais o corpo** (o erro do V8 ecoa o trecho do JSON = conversa), erro do chat loga só `err.message`. Teste novo `rate-limit.test.ts` (8 testes). **Limitação registrada:** o limite é por instância no Vercel (para teto global: Upstash/WAF).

### Log - Fase 6 (sessão 8, 05/10/2026)

**Criados:** `supabase/migrations/20261005000001_audit_logs.sql`, `src/lib/services/audit.ts`, `src/app/api/audit/route.ts`, `src/app/(app)/configuracoes/auditoria/page.tsx`, `src/lib/rate-limit.ts`, `scripts/ops/lgpd-retention-report.mjs`, testes `audit.test.ts` (10) e `rate-limit.test.ts` (8).
**Alterados:** `src/lib/api-auth.ts` (bypass dev removido), `README.md` (acesso inicial + seções Backup e LGPD), `.gitignore` (`*.log`), `sidebar.tsx` (link Auditoria), rotas `auth/login`, `auth/signup`, `appointments`, `appointments/[id]`, `pacientes`, `professionals`, `professionals/[id]`, `especialidades`, `especialidades/[id]`, `clinica`, `webhooks/komunika`, `webhooks/lojou`, `auth/email`, `chat` (audit + rate limit + PII), `auth-flows.test.ts` (ignora inserts de `audit_logs`).
**Removidos do git/disco:** `server.log`, `src/lib/db.ts.backup`, `supabase-migration.backup.sql`, `data/20260911000002_rls_fix.backup.sql`, cópia `AgenteIA/` (conferida contra o histórico antes de apagar).

**Validação executada:** `eslint` ✅ 0/0 · `tsc --noEmit` ✅ · `vitest` ✅ **121/121** (11 arquivos, +18) · `test:coverage` ✅ exit 0 (**21.97% stmt / 13.77% branch / 23.19% func / 23.38% lines**, acima dos gates 17/8/18/19) · `next build` ✅ exit 0 · cadeia **14/14 migrations em banco limpo com Docker** (exit 0, `audit_logs` criada e com RLS negado) · `lgpd-retention-report.mjs` exit 0 contra o banco real.

**Pendências manuais desta fase:** (1) **aplicar `20261005000001_audit_logs.sql` no SQL Editor da Supabase de produção** — sem a tabela, o `recordAudit` engole o erro e não há trilha; (2) exigir o status check `quality` na branch protection (pendência da Fase 5, segue sem `gh` CLI); (3) **rotacionar as 5 chaves** expostas + `OPS_ADMIN_PASSWORD`/`CRON_SECRET` nos painéis e na Vercel; (4) rate limit é por instância no Vercel (teto global exigiria Upstash/WAF).

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
| ~~Painel com métricas corretas~~ | **resolvido (Fase 4, 05/10/2026)** — conversão no KPI, "Consultas Hoje" do dia, pacientes da tabela `patients`, pendência real e erros visíveis |
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
