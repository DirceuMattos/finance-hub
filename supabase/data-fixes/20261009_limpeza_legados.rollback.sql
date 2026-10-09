-- Restaura a limpeza de 09/10/2026 a partir do schema "archive".
BEGIN;
INSERT INTO public.transactions SELECT * FROM archive.transactions_cancelled_20261009;
-- desliga a reconstrução automática de parcelas para não duplicar ao restaurar
ALTER TABLE public.card_purchases DISABLE TRIGGER trg_card_purchase_rebuild_installments;
INSERT INTO public.card_purchases SELECT * FROM archive.card_purchases_20261009;
ALTER TABLE public.card_purchases ENABLE TRIGGER trg_card_purchase_rebuild_installments;
INSERT INTO public.card_installments SELECT * FROM archive.card_installments_20261009;
UPDATE public.transactions t SET source_type = a.source_type, source_id = a.source_id
  FROM archive.supermercado_vinculo_20261009 a WHERE a.id = t.id;
UPDATE public.transactions t SET center_cost = a.center_cost
  FROM archive.centro_custo_legado_20261009 a WHERE a.id = t.id;
ALTER TABLE archive.staging_lancamentos_cartoes_import SET SCHEMA public;
ALTER TABLE archive.tmp_card_import_work               SET SCHEMA public;
ALTER TABLE archive.tmp_card_purchase_map              SET SCHEMA public;
ALTER TABLE archive.staging_lancamentos_comuns_import  SET SCHEMA public;
ALTER TABLE archive.migration_category_map             SET SCHEMA public;
COMMIT;
