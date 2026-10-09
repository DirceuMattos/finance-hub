BEGIN;
UPDATE public.investment_snapshots t SET closing_value = a.closing_value FROM archive.investment_jun_20261009b a WHERE a.id = t.id;
UPDATE public.patrimony_snapshots t SET item_name = a.item_name, closing_value = a.closing_value FROM archive.patrimony_ajustes_20261009b a WHERE a.id = t.id;
COMMIT;
