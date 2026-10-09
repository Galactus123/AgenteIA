# SaúdeSync

Sistema Inteligente de Agendamento com IA para Clínicas Privadas.

SaaS com Inteligência Artificial que automatiza o atendimento inicial de clínicas privadas via WhatsApp: entende o motivo da consulta, sugere a especialidade, agenda, confirma, envia lembretes e permite remarcar/cancelar.

## Requisitos

- Node.js 22+ (testado com Node 24; `engines`, `.node-version` e CI usam 22)
- npm

## Instalação

```bash
npm install
cp .env.example .env.local
```

Edite `.env.local` e informe a chave de IA:

```env
OPENAI_API_KEY=sua-chave
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
SESSION_SECRET=um-segredo-forte
```

Providers OpenAI-compatíveis (OpenAI, DeepSeek, Groq etc.) funcionam trocando a `OPENAI_BASE_URL`.

## Executar

```bash
npm run dev
```

Acesse http://localhost:3000

**Acesso inicial:** não existe senha padrão — crie a conta pelo fluxo de cadastro (e-mail + senha). Reparo de admin local: `scripts/ops/README.md` (`OPS_ADMIN_EMAIL`/`OPS_ADMIN_PASSWORD` no `.env`, nunca no Git).

## O que o MVP faz

- **Atendimento IA (simulador de WhatsApp):** página "Atendimento IA" simula a conversa de um paciente com a recepcionista virtual. O agente usa function-calling para consultar especialidades, buscar horários reais e agendar/remarcar/cancelar consultas no banco.
- **Dashboard:** consultas marcadas, canceladas, remarcadas, médicos ativos, volume atendido pela IA e taxa de conversão, além da agenda do dia.
- **Cadastros:** clínica, médicos (com agenda semanal), especialidades (com palavras-chave que orientam a IA).
- **Lembretes automáticos:** enviados 24h e 2h antes da consulta; aparecem como mensagens do bot na conversa do paciente. Verificados a cada minuto em segundo plano.
- **Regras de negócio:** cancelamento/remarcação com 4h de antecedência, máximo de 1 remarcação, agendamento no mesmo dia até 2h antes, e disputa de horário resolvida por disponibilidade real.
- **Segurança e auditoria:** audit log das ações sensíveis (Configurações → Auditoria, tabela `audit_logs` com RLS deny-all), rate limiting em login/cadastro/webhooks, PII mascarada nos logs e proteção de rotas internas por `CRON_SECRET`/`INTERNAL_API_TOKEN` (sem bypass de dev). Os webhooks de entrada (Komunika e Lojou) são **fail-closed**: sem `KOMUNIKA_WEBHOOK_SECRET`/`LOJOU_WEBHOOK_SECRET` definidos respondem `503` e não processam nada; a Komunika valida `x-komunika-signature` (HMAC-SHA256) e a Lojou valida `x-lojou-signature` (HMAC-SHA256 do corpo) com fallback ao `?secret=` na query enquanto a plataforma não assina os webhooks.
- **Modelo pós-pagamento (acesso estrito):** o acesso ao sistema — páginas do painel, APIs operacionais, agente de WhatsApp (webhook de entrada) e entrega da fila `outbox` — exige linha **`active`** em `subscriptions` para a clínica (pagamento confirmado pelo webhook da Lojou; `trialing` legado e estados pendentes/cancelados bloqueiam com 402; kill switch `SUBSCRIPTION_GATE_DISABLED`; sem vínculo em `clinic_members` → 402, nunca herda a assinatura de outra clínica). **Não há teste grátis nem captura de leads públicos** (funil `/teste-gratis` + `POST /api/leads` removidos; tabela `trial_leads` removida pela migration `20261009000002`). Quando o webhook da Lojou confirma o pagamento, a instância WhatsApp é **atribuída à clínica**: se `clinics.komunika_instance_id` estiver vazio, a global `KOMUNIKA_INSTANCE_ID` é gravada na linha da clínica (nunca sobrescreve uma já registada) e só depois a instância é conectada — **a Komunika só é provisionada/configurada após a confirmação do pagamento**. **Todo envio é pela instância da própria clínica:** a fila `outbox` grava o `clinic_id` na mensagem (sem `DEFAULT` — `NULL` = sem tenant = entrega bloqueada pelo gate), o webhook de entrada resolve a clínica dona da instância de entrada (`getClinicIdByInstanceId`, instância global consultada e só responde se já atribuída a uma clínica) e as notificações do médico/recepção/receipt usam `getKomunikaInstanceIdForClinic`. A fila `outbox` trata "Komunika não configurado" como falha **transitória com backoff** (1/5/15/60/240 min, até 5 tentativas) em vez de `failed` permanente à 1ª tentativa; assinatura inativa é `failed` definitivo (sem retry).

## Estrutura

- `src/app/` — páginas e API routes
- `src/lib/` — serviços, regras de negócio, agente de IA e integrações (persistência no Supabase)
- `src/lib/agent/` — cliente LLM, tools e orquestrador da conversa
- `data/` — scripts de auditoria e o backup legado do SQLite (fora do `tsconfig` e do `eslint`)

## Banco de dados

O sistema usa **Supabase (Postgres + Auth)** como fonte única desde a Fase 1: `supabaseAdmin` (`service_role`) é a única porta de escrita, o `anon` não tem GRANT de tabela e o schema nasce de `supabase/migrations/`. Seed e verificação: `node scripts/setup-supabase.mjs` (exige Node 22+). `data/saudesync.db` é apenas o SQLite legado, lido por esse script.

## Verificação (smoke, concorrência, CI)

- **Smoke test do deploy** (somente leitura): `node scripts/ops/smoke-test.mjs` usa `PUBLIC_URL` do `.env` (ou `--url http://localhost:3000`); confere `/api/health` (agora com **ping real no banco**: `200 {status:"ok"}` só se o PostgREST responde, senão `503 {status:"degraded"}`), páginas públicas, redirect de páginas protegidas para `/login`, APIs com 401 direto (nunca redirect) e login inválido com 401.
- **Smoke diário de produção:** `.github/workflows/smoke.yml` roda o mesmo script todo dia às **05:23 UTC** (e sob demanda via *Run workflow*) contra a URL da produção — job vermelho no Actions vira alerta por e-mail do GitHub, sem serviço externo. A URL é configurável pela variável de repositório `SMOKE_URL`.
- **Concorrência de slot** (requer Docker): `node scripts/ops/slot-concurrency-test.mjs` sobe um Postgres 16 descartável, aplica a cadeia inteira de migrations e dispara 2 e 5 inserções simultâneas no mesmo `(professional_id, starts_at)` — só pode vencer 1, e o índice parcial `uq_appointments_professional_start` rejeita as demais com `23505`.
- **Schema em banco limpo** (requer Docker): `node scripts/ops/clean-db-test.mjs` valida as 20 migrations do zero e gera `scripts/ops/clean-db-run.log`.
- **CI:** workflow em `.github/workflows/ci.yml` (Node 22) roda lint, `tsc`, `npm test` e cobertura com gates em `vitest.config.ts` (**46 / 35 / 45 / 47** — baseline 49.58 / 38.72 / 49.31 / 51.4 da Fase 8); o status check **`quality`** deve ser exigido na branch protection (configuração manual no GitHub).
- **Crons (Vercel):** `vercel.json` agenda `/api/reminders/run` (03:17 UTC), `/api/outbox/run` (03:41) e `/api/subscription/cycle/run` (01:51); todas exigem o token interno. Estado do agendador: `SELECT jobname FROM cron.job;` no SQL Editor.

## Backup e restauração

- **Gerenciado (Supabase):** Dashboard → **Database → Backups** mantém snapshots diários + PITR do plano. Restauração de ponto no tempo: botão *Restore* na mesma tela (novo projeto clonado; depois trocar o `NEXT_PUBLIC_SUPABASE_URL` nos ambientes ou apontar o DNS).
- **Manual (recomendado 1x/dia como cópia fria):**

  ```bash
  # SUPABASE_DB_URL = Settings → Database → Connection string (modo SESSION)
  pg_dump "$SUPABASE_DB_URL" -Fc -f "saudesync-$(date +%F).dump"
  # restaurar (ambiente de teste ou recuperação):
  pg_restore --clean --if-exists --no-owner -d "$SUPABASE_DB_URL" saudesync-AAAA-MM-DD.dump
  ```

  O dump cobre `public` + `auth` (usuários) + `storage`. Guarde o arquivo fora da Vercel — **segredos não vão no dump** (ficam em `.env`/Vercel e devem ser rotacionados em caso de exposição).
- **Schema como código:** o schema é 100% reconstruível por `supabase/migrations/` (idempotente). A cadeia inteira é validada em banco limpo com `node scripts/ops/clean-db-test.mjs` (requer Docker).
- **Drill de restauração:** restaure o último dump num projeto de testes e confira `SELECT count(*)` nas tabelas críticas (`appointments`, `patients`, `conversations`) a cada trimestre.

## Privacidade (LGPD)

Políticas de retenção rodam uma vez no startup (`src/instrumentation.ts` → `src/lib/lgpd.ts`): mensagens com mais de 90 dias são apagadas, conversas inativas há 365 dias são anonimizadas (`Paciente-<pseudônimo>`) e usuários inativos há 30 dias são removidos. Relatório somente-leitura do que seria aplicado: `node scripts/ops/lgpd-retention-report.mjs` (usa `SUPABASE_SERVICE_ROLE_KEY`, não escreve nada).

## Segurança operacional

### Rotação das 5 chaves do lembrete de segurança

```bash
node scripts/ops/rotation-checklist.mjs
```

O script diz **onde** rotacionar cada chave (`OPENAI_API_KEY`, `KOMUNIKA_API_TOKEN`, `KOMUNIKA_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `LOJOU_WEBHOOK_SECRET`) e confere se o valor atual do `.env`/`.env.local` ainda aparece no histórico do Git (`git log --all -S`). Não imprime valores — só status. Fluxo: rode → rotacione no painel indicado → atualize `.env` **e** as variáveis da Vercel → rode de novo até `5/5 ok`. As variáveis da Vercel mudam em **Settings → Environment Variables** (troca exige novo deploy).

### Branch protection (exigir o check `quality` em `main`)

1. No GitHub: **Settings → Branches → Add branch protection rule**.
2. Pattern: `main`.
3. Marcar: **Require a pull request before merging** (1 review se quiser) e **Require status checks to pass** → buscar e adicionar o job `quality` (roda lint + tsc + testes + coverage + build). Recomendado: **Include administrators**.
4. **Create branch protection rule**.

Sem isso, qualquer push direto em `main` vai para produção (deploy automático) sem passar pelos gates.

## Observação

O atendimento por IA requer a chave configurada. Sem ela, o resto do sistema funciona normalmente.
