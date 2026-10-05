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

**Acesso inicial:** `admin` / `admin123`

## O que o MVP faz

- **Atendimento IA (simulador de WhatsApp):** página "Atendimento IA" simula a conversa de um paciente com a recepcionista virtual. O agente usa function-calling para consultar especialidades, buscar horários reais e agendar/remarcar/cancelar consultas no banco.
- **Dashboard:** consultas marcadas, canceladas, remarcadas, médicos ativos, volume atendido pela IA e taxa de conversão, além da agenda do dia.
- **Cadastros:** clínica, médicos (com agenda semanal), especialidades (com palavras-chave que orientam a IA).
- **Lembretes automáticos:** enviados 24h e 2h antes da consulta; aparecem como mensagens do bot na conversa do paciente. Verificados a cada minuto em segundo plano.
- **Regras de negócio:** cancelamento/remarcação com 4h de antecedência, máximo de 1 remarcação, agendamento no mesmo dia até 2h antes, e disputa de horário resolvida por disponibilidade real.

## Estrutura

- `src/app/` — páginas e API routes
- `src/lib/` — serviços, regras de negócio, agente de IA e integrações (persistência no Supabase)
- `src/lib/agent/` — cliente LLM, tools e orquestrador da conversa
- `data/` — scripts de auditoria e o backup legado do SQLite (fora do `tsconfig` e do `eslint`)

## Banco de dados

O sistema usa **Supabase (Postgres + Auth)** como fonte única desde a Fase 1: `supabaseAdmin` (`service_role`) é a única porta de escrita, o `anon` não tem GRANT de tabela e o schema nasce de `supabase/migrations/`. Seed e verificação: `node scripts/setup-supabase.mjs` (exige Node 22+). `data/saudesync.db` é apenas o SQLite legado, lido por esse script.

## Observação

O atendimento por IA requer a chave configurada. Sem ela, o resto do sistema funciona normalmente.
