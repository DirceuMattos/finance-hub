-- Somente leitura. Execute antes da migration 20260920000000.

-- 1. Recorrências ativas sem data inicial não conseguem gerar lançamentos.
SELECT id, description, frequency, starts_on, ends_on, is_active
FROM public.recurrences
WHERE is_active = true
  AND starts_on IS NULL
ORDER BY description;

-- 2. Duplicidades preexistentes não são removidas automaticamente.
SELECT source_id, due_date, COUNT(*) AS duplicate_count
FROM public.transactions
WHERE source_type = 'recurrence'
  AND source_id IS NOT NULL
GROUP BY source_id, due_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, due_date;

-- 3. Recorrências sem nenhum lançamento associado.
SELECT r.id, r.description, r.frequency, r.starts_on, r.ends_on,
       r.last_generated_until
FROM public.recurrences r
WHERE r.is_active = true
  AND r.starts_on IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.source_type = 'recurrence'
      AND t.source_id = r.id
  )
ORDER BY r.starts_on, r.description;

-- 4. Confirma as colunas exigidas pela migration.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'recurrences' AND column_name IN (
      'id', 'description', 'amount', 'frequency', 'transaction_type',
      'category_id', 'financial_entity_id', 'account_id', 'starts_on',
      'ends_on', 'due_day', 'day_of_week', 'is_active',
      'generate_as_planned', 'last_generated_until', 'payee', 'notes',
      'center_cost'
    ))
    OR
    (table_name = 'transactions' AND column_name IN (
      'description', 'amount', 'transaction_type', 'category_id',
      'financial_entity_id', 'account_id', 'competence_date', 'due_date',
      'status', 'payee', 'notes', 'center_cost', 'source_type', 'source_id'
    ))
  )
ORDER BY table_name, column_name;
