-- Investimentos abr e mai/2026 (hoje em aberto): fechamento = abertura do mês seguinte,
-- mesma regra usada em junho. Decisão do Dirceu em 11/10/2026 (série estável, sem grandes variações).
-- Rollback: UPDATE public.investment_snapshots t SET closing_value = a.closing_value
--             FROM archive.investment_abr_mai_20261011 a WHERE a.id = t.id;
BEGIN;
CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated;
DO $fix$
DECLARE v_n integer;
BEGIN
  SELECT COUNT(*) INTO v_n FROM public.investment_snapshots j
    JOIN public.investment_snapshots l ON l.investment_class_id = j.investment_class_id
     AND l.financial_entity_id = j.financial_entity_id
     AND l.reference_month = (j.reference_month + INTERVAL '1 month')::date
   WHERE j.reference_month IN (DATE '2026-04-01', DATE '2026-05-01') AND j.closing_value IS NULL;
  IF v_n <> 20 THEN RAISE EXCEPTION 'Esperados 20 investimentos (abr+mai) em aberto com mês seguinte, encontrados %', v_n; END IF;
  EXECUTE 'CREATE TABLE archive.investment_abr_mai_20261011 AS SELECT id, closing_value FROM public.investment_snapshots
            WHERE reference_month IN (DATE ''2026-04-01'', DATE ''2026-05-01'') AND closing_value IS NULL';
  UPDATE public.investment_snapshots j SET closing_value = l.opening_value
    FROM public.investment_snapshots l
   WHERE l.investment_class_id = j.investment_class_id AND l.financial_entity_id = j.financial_entity_id
     AND l.reference_month = (j.reference_month + INTERVAL '1 month')::date
     AND j.reference_month IN (DATE '2026-04-01', DATE '2026-05-01') AND j.closing_value IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 20 THEN RAISE EXCEPTION 'Atualizados %, esperados 20', v_n; END IF;
END;
$fix$;
REVOKE ALL ON ALL TABLES IN SCHEMA archive FROM PUBLIC, anon, authenticated;
COMMIT;

SELECT reference_month, COUNT(*) FILTER (WHERE closing_value IS NULL) AS em_aberto, SUM(closing_value) AS total_fechamento
  FROM public.investment_snapshots WHERE reference_month BETWEEN DATE '2026-03-01' AND DATE '2026-06-01'
 GROUP BY 1 ORDER BY 1;
