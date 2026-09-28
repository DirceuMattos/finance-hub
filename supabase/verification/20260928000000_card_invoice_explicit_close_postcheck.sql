-- Pós-verificação SOMENTE LEITURA da migration 20260928000000.
-- Esperado: 1 versão (com p_close), anon sem acesso, authenticated com acesso.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
  FROM pg_proc p
 WHERE p.proname = 'settle_card_invoice';
