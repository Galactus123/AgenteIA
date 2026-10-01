# scripts/ops — procedimentos de reparo (fora do fluxo normal)

Scripts de **diagnóstico e reparo** usados durante o incidente de login
(migração 005 inseriu linhas direto em `auth.users`). Não fazem parte do
setup normal do projeto — o setup é `scripts/setup-supabase.mjs`.

> Nenhum script desta pasta pode conter senha. Credenciais saem de
> variáveis de ambiente definidas no `.env` (**não versionado**).

## Variáveis obrigatórias

Adicione ao `.env` da raiz (nunca ao `.env.example`):

```dotenv
OPS_ADMIN_EMAIL=seu-admin@exemplo.com
OPS_ADMIN_PASSWORD=senha-forte-aqui
```

## Fluxo de reparo do auth

1. **Diagnóstico do schema** — SQL Editor do Supabase:
   `diagnose-auth-schema.sql`
   (mostra colunas, triggers e constraints de `auth.users`).
2. **Diagnóstico via API** — confirma se `auth.admin.createUser` funciona:

   ```bash
   node scripts/ops/fix-auth-user.mjs
   ```

3. **Limpar registro corrompido** (apenas se o passo 1 mostrar erro):
   `fix-auth-schema.sql` no SQL Editor.
4. **Recriar o usuário de admin** (destrutivo; religa o tenant ao novo UUID):

   ```bash
   node scripts/ops/recreate-auth-user.mjs
   ```

5. **Recriar registros de tenant** (`profiles`, `admin_profiles`,
   `clinic_members`) — idempotente:

   ```bash
   node scripts/ops/recreate-cascade.mjs
   ```

6. **Conferir** e validar o login pelo app:

   ```bash
   node scripts/ops/check-user.mjs
   ```

## Rotacione as credenciais

A senha antiga do admin ficou exposta no histórico do Git e **precisa ser
rotacionada** no painel do Supabase (Authentication → Users → Reset password)
e as variáveis atualizadas na Vercel. O mesmo vale para as chaves listadas
no lembrete de segurança do `PROGRESSO.md`.
