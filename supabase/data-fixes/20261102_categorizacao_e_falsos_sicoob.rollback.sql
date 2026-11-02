-- Desfaz 20261102_categorizacao_e_falsos_sicoob.sql: devolve categoria e status anteriores e recalcula saldos.
BEGIN;
UPDATE public.transactions t SET category_id = x.category_id, status = x.status
  FROM archive.categorizacao_20261102 x WHERE x.id = t.id;
DELETE FROM public.categories c
 WHERE c.name = 'Transferências entre contas'
   AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.category_id = c.id);
SELECT public.recalculate_account_balances_from_date('2026-04-01');
COMMIT;
-- Depois de conferir: DROP TABLE archive.categorizacao_20261102;
