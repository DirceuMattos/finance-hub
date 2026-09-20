-- Somente leitura. Execute depois da migration e de criar uma recorrência de teste.

-- 1. Confirma a instalação dos dois gatilhos.
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'recurrences'
  AND trigger_name IN (
    'generate_recurrence_transactions_after_insert',
    'generate_recurrence_transactions_after_start_date'
  )
ORDER BY trigger_name;

-- 2. Confirma que novas recorrências possuem lançamentos vinculados.
SELECT r.id, r.description, r.created_at, r.last_generated_until,
       COUNT(t.id) AS generated_transactions,
       MIN(t.due_date) AS first_due_date,
       MAX(t.due_date) AS last_due_date
FROM public.recurrences r
LEFT JOIN public.transactions t
  ON t.source_type = 'recurrence'
 AND t.source_id = r.id
WHERE r.created_at >= CURRENT_TIMESTAMP - interval '1 day'
GROUP BY r.id, r.description, r.created_at, r.last_generated_until
ORDER BY r.created_at DESC;

-- 3. Confirma que não foram criadas duplicidades pela nova geração.
SELECT source_id, due_date, COUNT(*) AS duplicate_count
FROM public.transactions
WHERE source_type = 'recurrence'
  AND source_id IS NOT NULL
GROUP BY source_id, due_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, due_date;
