-- Rollback conservador do backfill executado em producao em 2026-09-20.
-- Deve ser executado antes do rollback 20260920000000.
-- Se qualquer lancamento tiver sido alterado, quitado, duplicado ou ampliado,
-- toda a transacao aborta e nenhum dado e removido.

BEGIN;

DO $rollback$
DECLARE
  v_linked_count integer;
  v_unchanged_count integer;
  v_updated_recurrences integer;
  v_deleted_transactions integer;
BEGIN
  -- Serializa o rollback com alteracoes concorrentes nessas recorrencias.
  PERFORM 1
    FROM public.recurrences
   WHERE id IN (
     'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid,
     'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid
   )
   FOR UPDATE;

  PERFORM 1
    FROM public.transactions
   WHERE source_type = 'recurrence'
     AND source_id IN (
       'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid,
       'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid
     )
   FOR UPDATE;

  SELECT COUNT(*)::integer
    INTO v_linked_count
    FROM public.transactions
   WHERE source_type = 'recurrence'
     AND source_id IN (
       'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid,
       'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid
     );

  WITH expected(source_id, due_date) AS (
    VALUES
      ('ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid, DATE '2026-09-10'),
      ('ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid, DATE '2026-10-10'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2026-07-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2026-08-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2026-09-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2026-10-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2026-11-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2026-12-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2027-01-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2027-02-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2027-03-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2027-04-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2027-05-05'),
      ('e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid, DATE '2027-06-05')
  )
  SELECT COUNT(*)::integer
    INTO v_unchanged_count
    FROM expected e
    JOIN public.transactions t
      ON t.source_id = e.source_id
     AND t.due_date = e.due_date
     AND t.source_type = 'recurrence'
    JOIN public.recurrences r ON r.id = e.source_id
   WHERE t.status = 'planned'
     AND t.description IS NOT DISTINCT FROM r.description
     AND t.transaction_type IS NOT DISTINCT FROM r.transaction_type
     AND t.category_id IS NOT DISTINCT FROM r.category_id
     AND t.financial_entity_id IS NOT DISTINCT FROM r.financial_entity_id
     AND t.account_id IS NOT DISTINCT FROM r.account_id
     AND t.amount IS NOT DISTINCT FROM r.amount
     AND t.competence_date = date_trunc('month', e.due_date)::date
     AND t.payee IS NOT DISTINCT FROM r.payee
     AND t.notes IS NOT DISTINCT FROM r.notes
     AND t.center_cost IS NOT DISTINCT FROM r.center_cost;

  IF v_linked_count <> 14 OR v_unchanged_count <> 14 THEN
    RAISE EXCEPTION
      'Rollback cancelado: esperados 14 lancamentos intactos; vinculados=%, intactos=%',
      v_linked_count,
      v_unchanged_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.recurrences
     WHERE id = 'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid
       AND last_generated_until = DATE '2026-11-09'
  ) OR NOT EXISTS (
    SELECT 1
      FROM public.recurrences
     WHERE id = 'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid
       AND last_generated_until = DATE '2027-06-05'
  ) THEN
    RAISE EXCEPTION 'Rollback cancelado: marcadores de geracao foram alterados';
  END IF;

  DELETE FROM public.transactions
   WHERE source_type = 'recurrence'
     AND source_id IN (
       'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid,
       'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid
     );
  GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

  IF v_deleted_transactions <> 14 THEN
    RAISE EXCEPTION
      'Rollback cancelado: removidos %, esperados 14',
      v_deleted_transactions;
  END IF;

  UPDATE public.recurrences
     SET last_generated_until = NULL
   WHERE (id = 'ae663c57-3404-4ba4-bd62-2e3f9160541b'::uuid
          AND last_generated_until = DATE '2026-11-09')
      OR (id = 'e81c949a-0b2e-4c5c-9bd5-7a8d8dc169ad'::uuid
          AND last_generated_until = DATE '2027-06-05');
  GET DIAGNOSTICS v_updated_recurrences = ROW_COUNT;

  IF v_updated_recurrences <> 2 THEN
    RAISE EXCEPTION
      'Rollback cancelado: restauradas %, esperadas 2 recorrencias',
      v_updated_recurrences;
  END IF;
END;
$rollback$;

COMMIT;
