-- Ajustes aprovados pelo Dirceu em 09/10/2026:
-- 1. Investimentos: fechamento de jun/2026 (hoje em aberto) = abertura de jul/2026 do mesmo investimento (10 linhas)
-- 2. Patrimônio: Veículos - Honda, fechamento de jun/2026 125.000 -> 150.000
-- 3. Patrimônio: nome "Conta Interenacional" -> "Conta Internacional" (jan a abr/2026, 4 linhas)
-- Rollback: ver 20261009_investimentos_patrimonio.rollback.sql (usa a cópia em archive.*_20261009b)
BEGIN;
CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated;
DO $fix$
DECLARE v_n integer;
BEGIN
  -- 1. Investimentos
  SELECT COUNT(*) INTO v_n FROM public.investment_snapshots j
    JOIN public.investment_snapshots l ON l.investment_class_id = j.investment_class_id
     AND l.financial_entity_id = j.financial_entity_id AND l.reference_month = DATE '2026-07-01'
   WHERE j.reference_month = DATE '2026-06-01' AND j.closing_value IS NULL;
  IF v_n <> 10 THEN RAISE EXCEPTION 'Esperados 10 investimentos de junho em aberto com julho, encontrados %', v_n; END IF;
  EXECUTE 'CREATE TABLE archive.investment_jun_20261009b AS SELECT id, closing_value FROM public.investment_snapshots
            WHERE reference_month = DATE ''2026-06-01'' AND closing_value IS NULL';
  UPDATE public.investment_snapshots j SET closing_value = l.opening_value
    FROM public.investment_snapshots l
   WHERE l.investment_class_id = j.investment_class_id AND l.financial_entity_id = j.financial_entity_id
     AND l.reference_month = DATE '2026-07-01' AND j.reference_month = DATE '2026-06-01' AND j.closing_value IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 10 THEN RAISE EXCEPTION 'Atualizados % investimentos, esperados 10', v_n; END IF;

  -- 2. Honda junho
  EXECUTE 'CREATE TABLE archive.patrimony_ajustes_20261009b AS SELECT id, item_name, closing_value FROM public.patrimony_snapshots
            WHERE id = ''0a97c4b3-9c51-4ac8-af24-f191d6f993ba'' OR item_name = ''Conta Interenacional''';
  UPDATE public.patrimony_snapshots SET closing_value = 150000
   WHERE id = '0a97c4b3-9c51-4ac8-af24-f191d6f993ba' AND item_name = 'Veículos - Honda'
     AND reference_month = DATE '2026-06-01' AND closing_value = 125000;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'Honda junho: atualizadas % linhas, esperada 1', v_n; END IF;

  -- 3. Nome Conta Internacional
  UPDATE public.patrimony_snapshots SET item_name = 'Conta Internacional' WHERE item_name = 'Conta Interenacional';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN RAISE EXCEPTION 'Conta Internacional: renomeadas % linhas, esperadas 4', v_n; END IF;
END;
$fix$;
REVOKE ALL ON ALL TABLES IN SCHEMA archive FROM PUBLIC, anon, authenticated;
COMMIT;

SELECT 'investimentos jun em aberto (deve ser 0)' AS item, COUNT(*)::text AS valor FROM public.investment_snapshots WHERE reference_month = DATE '2026-06-01' AND closing_value IS NULL
UNION ALL SELECT 'Honda jun fechamento', closing_value::text FROM public.patrimony_snapshots WHERE id = '0a97c4b3-9c51-4ac8-af24-f191d6f993ba'
UNION ALL SELECT 'Conta Interenacional (deve ser 0)', COUNT(*)::text FROM public.patrimony_snapshots WHERE item_name = 'Conta Interenacional';
