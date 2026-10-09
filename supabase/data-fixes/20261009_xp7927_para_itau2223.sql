-- Move os 5 lançamentos do centro de custo antigo 'XP 7927 - Pessoal' para 'Itaú 2223 - Pessoal'
-- e cancela 'Vestuário/Perfumes' R$ 72,77 (se ainda estiver a pagar). Decisão do Dirceu, 09/10/2026.
-- Rollback: UPDATE public.transactions t SET center_cost = a.center_cost, status = a.status
--             FROM archive.centro_custo_xp_20261009 a WHERE a.id = t.id;
BEGIN;
DO $fix$
DECLARE v_n integer; v_sum numeric;
BEGIN
  SELECT COUNT(*), SUM(amount) INTO v_n, v_sum FROM public.transactions WHERE center_cost = 'XP 7927 - Pessoal';
  IF v_n <> 5 OR v_sum <> 1455.10 THEN RAISE EXCEPTION 'Esperados 5 / 1455.10 em XP 7927 - Pessoal, encontrados % / %', v_n, v_sum; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cards WHERE id = '770aa888-5643-4ba7-8829-58328de652ec' AND name = 'Itaú 2223 - Pessoal') THEN
    RAISE EXCEPTION 'Cartão Itaú 2223 - Pessoal não encontrado';
  END IF;
  EXECUTE 'CREATE TABLE archive.centro_custo_xp_20261009 AS SELECT id, center_cost, status FROM public.transactions WHERE center_cost = ''XP 7927 - Pessoal''';
  REVOKE ALL ON archive.centro_custo_xp_20261009 FROM PUBLIC, anon, authenticated;
  UPDATE public.transactions SET status = 'cancelled'
   WHERE id = '431e5faa-97bd-4c85-905c-4b26a96cff4a' AND amount = 72.77 AND status = 'planned';
  UPDATE public.transactions SET center_cost = 'Itaú 2223 - Pessoal' WHERE center_cost = 'XP 7927 - Pessoal';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 5 THEN RAISE EXCEPTION 'Movidos %, esperados 5', v_n; END IF;
END;
$fix$;
COMMIT;

SELECT description, amount, status, due_date, payment_date, center_cost
  FROM public.transactions WHERE id IN (SELECT id FROM archive.centro_custo_xp_20261009) ORDER BY due_date NULLS LAST;
