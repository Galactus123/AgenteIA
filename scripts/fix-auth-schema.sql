-- ============================================================
-- FIX DEFINITIVO: Limpar auth.users corrompido e recriar
-- Causa: Migration 005 fez INSERT manual em auth.users
--        com colunas que nao existem ou triggers quebrados
-- ============================================================
-- EXECUTAR NO SUPABASE SQL EDITOR (Dashboard > SQL Editor)
-- ============================================================

-- STEP 1: Verificar o usuario corrompido
SELECT id, email, email_confirmed_at, created_at, encrypted_password
FROM auth.users
WHERE email = 'galactusbank77@gmail.com';

-- STEP 2: Deletar o registro corrompido
DELETE FROM auth.users
WHERE email = 'galactusbank77@gmail.com';

-- STEP 3: Tambem limpar por UUID se existir registro fantasma
DELETE FROM auth.users
WHERE id = 'cd4ac28d-cb65-4b39-9578-ad23c1c46c4d';

-- STEP 4: Verificar que foi removido
SELECT COUNT(*) as remaining FROM auth.users
WHERE email = 'galactusbank77@gmail.com';

-- STEP 5: Verificar que o auth schema esta funcional
-- (isto deve retornar a lista de usuarios sem erro)
SELECT id, email FROM auth.users LIMIT 5;
