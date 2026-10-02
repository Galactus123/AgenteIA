-- ============================================================
-- FASE 2.4 - revogar acesso de `anon` as tabelas do schema public
-- Executar no Supabase SQL Editor (idempotente)
-- ============================================================
--
-- MAPA DE CHAVES (decisao da Fase 2.4)
--
--   service_role  -> src/lib/supabase.ts (`supabaseAdmin`): todos os
--                    `src/lib/services/*`, webhooks e rotas de API.
--                    Bypassa RLS. So no servidor, nunca no browser.
--   anon          -> SO Supabase Auth (login, signup, logout, me, password,
--                    email + proxy.ts + requireAuth + layouts). Esses fluxos
--                    falam com /auth/v1/* e NAO dependem de GRANT de tabela.
--                    Nenhuma consulta a PostgREST usa anon.
--   authenticated -> JWT do usuario no cookie: apenas
--                    src/app/(app)/chat/layout.tsx lendo `admin_profiles`
--                    (RLS de proprio registro).
--
-- O navegador nao consulta PostgREST direto: src/utils/supabase/client.ts
-- (createBrowserClient) nao tinha nenhum consumidor e foi removido.
--
-- HISTORICO: 002 ja revogou anon e 005 criou policies USING (false), mas a
-- 004 voltou a conceder GRANT ALL ... TO anon -> este arquivo conserta o
-- banco vivo; a 004 foi editada para nao conceder mais.
-- ============================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- O Supabase cria tabelas novas ja com grant para anon (default privileges).
-- Sem estes dois comandos, a proxima migration volta a conceder anon sozinha.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- Funcoes nao sao mexidas: EXECUTE vem de PUBLIC, e as tres do projeto
-- (get_user_clinic_ids, normalize_schedule, update_updated_at_column) nao
-- expoem dado para anon -- a primeira usa auth.uid(), que e NULL para anon.


-- ============================================================
-- VERIFICACAO - as consultas abaixo devem voltar VAZIAS
-- ============================================================
-- (1) sem risco de erro: mostra qualquer ACL explicita que cita `anon`.
--     Nota: relacl NULL = so o dono tem acesso, entao tambem esta OK.
SELECT n.nspname AS schema, c.relname, c.relacl
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relacl::text LIKE '%anon%'
ORDER BY c.relname;

-- (2)(3) privilegio efetivo de `anon` em tabelas e sequences do `public`.
-- As funcoes has_* ficam dentro de CASE: sem isso o planner reordena os
-- filtros e passa um indice para has_sequence_privilege, que responde com
-- "42809: ... is not a sequence" (foi o erro com
-- objects_bucket_id_name_version_key, um indice do schema storage).
SELECT c.relname AS tabela_com_grant_para_anon
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND CASE
        WHEN c.relkind = 'r' THEN has_table_privilege('anon', c.oid, 'SELECT')
        ELSE false
      END
ORDER BY c.relname;

SELECT c.relname AS sequence_com_grant_para_anon
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND CASE
        WHEN c.relkind = 'S' THEN has_sequence_privilege('anon', c.oid, 'USAGE')
        ELSE false
      END
ORDER BY c.relname;
