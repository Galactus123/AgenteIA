-- ============================================================
-- FIX: Reparar schema auth.users corrompido
-- Causa: Migration 005 fez INSERT direto em auth.users
--        com colunas que podem nao existir ou triggers quebrados
-- ============================================================
-- EXECUTAR NO SUPABASE SQL EDITOR
-- ============================================================

-- 1. Verificar se a tabela auth.users existe e tem as colunas corretas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Verificar triggers na tabela auth.users
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'users';

-- 3. Verificar constraints
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass;

-- 4. Verificar se o usuario existe em auth.users (query direta ao postgres)
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE id = 'cd4ac28d-cb65-4b39-9578-ad23c1c46c4d';

-- 5. Verificar se o usuario existe por email
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'galactusbank77@gmail.com';

-- 6. Listar todos os usuarios em auth.users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
LIMIT 20;
