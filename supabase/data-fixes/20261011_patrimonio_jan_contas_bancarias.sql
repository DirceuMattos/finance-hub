-- Patrimônio: fechamento de jan/2026 de "Contas Bancárias" estava +6.922,99; o correto é -6.922,99
-- (igual à abertura de fev/2026). Confirmado pelo Dirceu em 11/10/2026.
-- Rollback: mesmo UPDATE trocando os valores.
BEGIN;
DO $fix$
DECLARE v_n integer;
BEGIN
  UPDATE public.patrimony_snapshots SET closing_value = -6922.99
   WHERE item_name = 'Contas Bancárias' AND reference_month = DATE '2026-01-01' AND closing_value = 6922.99;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'Esperada 1 linha, atualizadas %. Nada foi alterado.', v_n; END IF;
END;
$fix$;
COMMIT;

SELECT reference_month, opening_value, closing_value FROM public.patrimony_snapshots
 WHERE item_name = 'Contas Bancárias' AND reference_month <= DATE '2026-02-01' ORDER BY reference_month;
