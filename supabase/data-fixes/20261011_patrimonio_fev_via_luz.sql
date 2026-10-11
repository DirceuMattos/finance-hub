-- Patrimônio: "Sociedade Via Luz" de fev/2026 está sem fechamento desde abril e tira fevereiro
-- (e, por consequência, janeiro) da linha do gráfico. Fechamento = abertura de mar/2026 do mesmo item.
-- Rollback: UPDATE public.patrimony_snapshots SET closing_value = NULL WHERE id = 'af6bd9f4-6585-450d-aafe-e5b8937d798e';
BEGIN;
DO $fix$
DECLARE v_n integer;
BEGIN
  UPDATE public.patrimony_snapshots f SET closing_value = m.opening_value
    FROM public.patrimony_snapshots m
   WHERE f.id = 'af6bd9f4-6585-450d-aafe-e5b8937d798e'
     AND f.item_name = 'Sociedade Via Luz' AND f.reference_month = DATE '2026-02-01' AND f.closing_value IS NULL
     AND m.item_name = f.item_name AND m.financial_entity_id = f.financial_entity_id AND m.reference_month = DATE '2026-03-01';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'Esperada 1 linha, atualizadas %', v_n; END IF;
END;
$fix$;
COMMIT;

SELECT reference_month, item_name, opening_value, closing_value FROM public.patrimony_snapshots
 WHERE item_name = 'Sociedade Via Luz' AND reference_month <= DATE '2026-03-01' ORDER BY reference_month;
