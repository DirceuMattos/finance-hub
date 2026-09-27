-- Registra de forma idempotente o backfill executado em producao em 2026-09-20.
-- O script pode ser reaplicado: a funcao geradora ignora competencias existentes.

BEGIN;

DO $backfill$
DECLARE
  v_ipva_count integer;
  v_seguro_count integer;
  v_duplicate_groups integer;
BEGIN
  PERFORM public.generate_transactions_for_recurrence_internal(
    'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid,
    NULL
  );
  PERFORM public.generate_transactions_for_recurrence_internal(
    'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid,
    NULL
  );

  SELECT COUNT(*)::integer
    INTO v_ipva_count
    FROM public.transactions
   WHERE source_type = 'recurrence'
     AND source_id = 'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid;

  SELECT COUNT(*)::integer
    INTO v_seguro_count
    FROM public.transactions
   WHERE source_type = 'recurrence'
     AND source_id = 'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid;

  SELECT COUNT(*)::integer
    INTO v_duplicate_groups
    FROM (
      SELECT source_id, due_date
        FROM public.transactions
       WHERE source_type = 'recurrence'
         AND source_id IN (
           'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid,
           'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid
         )
       GROUP BY source_id, due_date
      HAVING COUNT(*) > 1
    ) duplicates;

  IF v_ipva_count <> 2 OR v_seguro_count <> 12 OR v_duplicate_groups <> 0 THEN
    RAISE EXCEPTION
      'Backfill inconsistente: IPVA=%, Seguro=%, duplicidades=%',
      v_ipva_count,
      v_seguro_count,
      v_duplicate_groups;
  END IF;
END;
$backfill$;

COMMIT;
