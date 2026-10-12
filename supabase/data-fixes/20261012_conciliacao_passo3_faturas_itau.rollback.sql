-- Desfaz o passo 3 da conciliação de 12/10/2026.
BEGIN;
DELETE FROM public.transactions WHERE source_type = 'recurrence' AND source_id IN (SELECT id FROM public.recurrences WHERE notes LIKE 'Conciliação com extrato em 12/10/2026 (passo 3)%');
DELETE FROM public.recurrences WHERE notes LIKE 'Conciliação com extrato em 12/10/2026 (passo 3)%';
DELETE FROM public.transactions WHERE notes LIKE 'Conciliação com extrato em 12/10/2026 (passo 3)%' AND id NOT IN (SELECT id FROM archive.conciliacao3_20261012);
DELETE FROM public.transactions WHERE id IN (SELECT id FROM archive.conciliacao3_20261012);
INSERT INTO public.transactions SELECT * FROM archive.conciliacao3_20261012;
SELECT public.recalculate_account_balances_from_date('2026-04-01');
COMMIT;
