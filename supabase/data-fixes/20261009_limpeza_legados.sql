-- CAR-04f / REC-05 — limpeza de registros antigos (autorizada pelo Dirceu em 09/10/2026).
-- Tudo é COPIADO para o schema "archive" (fora da API do site) antes de ser removido.
-- Restauração: supabase/data-fixes/20261009_limpeza_legados.rollback.sql
--
-- 1. 7 lançamentos cancelados (todos manuais; cancelado não afeta saldo)          -> arquivar e excluir
-- 2. 229 parcelas canceladas + 2 parcelas antigas "projected" (jan e mar/2026)     -> arquivar e excluir
--    Nenhuma entra em cálculo algum (canceladas); 42 das 97 futuras têm lançamento
--    equivalente ativo; as demais são a série antiga "SUPERMERCADO" e a Veloe já
--    substituída por "Estacionamentos e Pedágios" nos lançamentos atuais.
-- 3. 8 compras antigas sem nenhuma parcela ativa                                    -> arquivar e excluir
--    (compras com parcela paga ficam: o histórico pago continua)
-- 4. 5 tabelas de importação (3 com dados de compras, 2 vazias)                     -> arquivar e remover
-- 5. 24 lançamentos importados em 24/04 ligados por engano à recorrência Supermercado
--    -> só desliga da recorrência (source_type/source_id = NULL). Nada é apagado.
--    A recorrência semanal em si NÃO é alterada.

BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated;

DO $fix$
DECLARE
  v_n integer;
  v_sum numeric;
BEGIN
  -- ---------- 1. lançamentos cancelados ----------
  SELECT COUNT(*) INTO v_n FROM public.transactions WHERE status = 'cancelled';
  IF v_n <> 7 THEN RAISE EXCEPTION 'Esperados 7 lançamentos cancelados, encontrados %', v_n; END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE status = 'cancelled' AND source_type = 'recurrence') THEN
    RAISE EXCEPTION 'Há cancelado gerado por recorrência: abortado (poderia ser recriado)';
  END IF;
  EXECUTE 'CREATE TABLE archive.transactions_cancelled_20261009 AS SELECT * FROM public.transactions WHERE status = ''cancelled''';
  DELETE FROM public.transactions WHERE status = 'cancelled';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 7 THEN RAISE EXCEPTION 'Excluídos % cancelados, esperados 7', v_n; END IF;

  -- ---------- 2 e 3. parcelas e compras antigas ----------
  SELECT COUNT(*), SUM(amount) INTO v_n, v_sum FROM public.card_installments WHERE status = 'cancelled';
  IF v_n <> 229 OR v_sum <> 55871.99 THEN RAISE EXCEPTION 'Parcelas canceladas: esperadas 229 / 55871.99, encontradas % / %', v_n, v_sum; END IF;
  SELECT COUNT(*) INTO v_n FROM public.card_installments
   WHERE status = 'projected' AND id IN ('5d11b0db-db68-44f2-b6ed-ffdf1a487634', 'a84525c3-7bf1-4dad-bc5d-1717d702708e')
     AND billing_month < DATE '2026-04-01';
  IF v_n <> 2 THEN RAISE EXCEPTION 'Esperadas 2 parcelas antigas projected, encontradas %', v_n; END IF;

  EXECUTE 'CREATE TABLE archive.card_installments_20261009 AS SELECT * FROM public.card_installments
            WHERE status = ''cancelled'' OR id IN (''5d11b0db-db68-44f2-b6ed-ffdf1a487634'', ''a84525c3-7bf1-4dad-bc5d-1717d702708e'')';
  DELETE FROM public.card_installments
   WHERE status = 'cancelled' OR id IN ('5d11b0db-db68-44f2-b6ed-ffdf1a487634', 'a84525c3-7bf1-4dad-bc5d-1717d702708e');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 231 THEN RAISE EXCEPTION 'Excluídas % parcelas, esperadas 231', v_n; END IF;

  SELECT COUNT(*) INTO v_n FROM public.card_purchases p
   WHERE NOT EXISTS (SELECT 1 FROM public.card_installments ci WHERE ci.card_purchase_id = p.id);
  IF v_n <> 8 THEN RAISE EXCEPTION 'Esperadas 8 compras sem parcela, encontradas %', v_n; END IF;
  EXECUTE 'CREATE TABLE archive.card_purchases_20261009 AS SELECT * FROM public.card_purchases p
            WHERE NOT EXISTS (SELECT 1 FROM public.card_installments ci WHERE ci.card_purchase_id = p.id)';
  DELETE FROM public.card_purchases p
   WHERE NOT EXISTS (SELECT 1 FROM public.card_installments ci WHERE ci.card_purchase_id = p.id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 8 THEN RAISE EXCEPTION 'Excluídas % compras, esperadas 8', v_n; END IF;
  -- Nenhuma parcela paga pode ter sido afetada
  SELECT COUNT(*) INTO v_n FROM public.card_installments WHERE status = 'paid';
  IF v_n <> 1894 THEN RAISE EXCEPTION 'Parcelas pagas mudaram: %', v_n; END IF;

  -- ---------- 5. Supermercado: desligar importados da recorrência ----------
  SELECT COUNT(*) INTO v_n FROM public.transactions
   WHERE source_type = 'recurrence' AND source_id = 'c87ce8a6-04a0-4cce-aa4a-285465ae8367'
     AND extract(day FROM due_date) = 25
     AND created_at >= TIMESTAMPTZ '2026-04-24 01:00+00' AND created_at < TIMESTAMPTZ '2026-04-24 02:00+00';
  IF v_n <> 24 THEN RAISE EXCEPTION 'Esperados 24 lançamentos importados do Supermercado, encontrados %', v_n; END IF;
  EXECUTE 'CREATE TABLE archive.supermercado_vinculo_20261009 AS SELECT id, source_type, source_id FROM public.transactions
            WHERE source_type = ''recurrence'' AND source_id = ''c87ce8a6-04a0-4cce-aa4a-285465ae8367''
              AND extract(day FROM due_date) = 25
              AND created_at >= TIMESTAMPTZ ''2026-04-24 01:00+00'' AND created_at < TIMESTAMPTZ ''2026-04-24 02:00+00''';
  UPDATE public.transactions t SET source_type = NULL, source_id = NULL
    FROM archive.supermercado_vinculo_20261009 a WHERE a.id = t.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 24 THEN RAISE EXCEPTION 'Desligados %, esperados 24', v_n; END IF;
END;
$fix$;

-- ---------- 4. tabelas de importação ----------
ALTER TABLE public.staging_lancamentos_cartoes_import SET SCHEMA archive;
ALTER TABLE public.tmp_card_import_work               SET SCHEMA archive;
ALTER TABLE public.tmp_card_purchase_map              SET SCHEMA archive;
ALTER TABLE public.staging_lancamentos_comuns_import  SET SCHEMA archive;
ALTER TABLE public.migration_category_map             SET SCHEMA archive;
REVOKE ALL ON ALL TABLES IN SCHEMA archive FROM PUBLIC, anon, authenticated;

COMMIT;

-- Conferência (somente leitura)
SELECT 'cancelados' AS item, COUNT(*) FROM public.transactions WHERE status = 'cancelled'
UNION ALL SELECT 'parcelas canceladas/projected', COUNT(*) FROM public.card_installments WHERE status <> 'paid'
UNION ALL SELECT 'parcelas pagas (deve ser 1894)', COUNT(*) FROM public.card_installments WHERE status = 'paid'
UNION ALL SELECT 'arquivo: lançamentos', COUNT(*) FROM archive.transactions_cancelled_20261009
UNION ALL SELECT 'arquivo: parcelas', COUNT(*) FROM archive.card_installments_20261009
UNION ALL SELECT 'arquivo: compras', COUNT(*) FROM archive.card_purchases_20261009
UNION ALL SELECT 'supermercado desligados', COUNT(*) FROM archive.supermercado_vinculo_20261009;
