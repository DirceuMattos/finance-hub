-- Rollback da migration 20260920000000.
-- Remove somente o gatilho e as funções adicionadas por ela.
-- Não apaga recorrências nem lançamentos já existentes.

BEGIN;

DROP TRIGGER IF EXISTS generate_recurrence_transactions_after_insert
  ON public.recurrences;
DROP TRIGGER IF EXISTS generate_recurrence_transactions_after_start_date
  ON public.recurrences;

DROP FUNCTION IF EXISTS public.generate_recurrence_transactions_after_insert();
DROP FUNCTION IF EXISTS public.generate_transactions_for_recurrence_internal(uuid, date);

COMMIT;
