-- Pós-verificação SOMENTE LEITURA da migration 20260927000000.
-- Esperado após a aplicação: 0 linhas.
SELECT 'fn_secdef_anon' AS check, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prosecdef
   AND has_function_privilege('anon', p.oid, 'EXECUTE')
   AND p.proname NOT IN ('is_admin', 'is_finance_admin')
UNION ALL
SELECT 'table_no_rls_anon', c.relname, NULL
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
   AND has_table_privilege('anon', c.oid, 'SELECT')
ORDER BY 1, 2;
