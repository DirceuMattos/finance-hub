-- Migration: Fix generate_recurring_transactions + add propagate_investment_month
-- Item 1: Fix recurrences not generating correctly
-- Items 3,4,8-12: Add investment propagation

-- ============================================================
-- FIX 1: generate_recurring_transactions
-- Changes:
--   - Only updates last_generated_until when transactions were created
--   - For monthly frequency, uses day from starts_on when due_day is null
--   - Skips recurrences already fully generated
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_recurring_transactions(
  p_until date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  rec RECORD;
  current_date_iter date;
  generate_until date;
  transactions_created integer := 0;
  rec_transactions_created integer := 0;
  next_day date;
  effective_due_day integer;
BEGIN
  generate_until := COALESCE(p_until, CURRENT_DATE + interval '12 months');

  FOR rec IN
    SELECT * FROM recurrences
    WHERE is_active = true
    AND starts_on IS NOT NULL
    AND (
      last_generated_until IS NULL
      OR last_generated_until < LEAST(generate_until, COALESCE(ends_on, generate_until))
    )
  LOOP
    rec_transactions_created := 0;
    current_date_iter := COALESCE(rec.last_generated_until, rec.starts_on - interval '1 day') + interval '1 day';

    -- For monthly: use due_day if set, otherwise extract day from starts_on
    effective_due_day := COALESCE(
      rec.due_day,
      CASE WHEN rec.frequency = 'monthly' THEN EXTRACT(DAY FROM rec.starts_on)::integer ELSE 1 END
    );

    WHILE current_date_iter <= LEAST(generate_until, COALESCE(rec.ends_on, generate_until)) LOOP

      -- Monthly
      IF rec.frequency = 'monthly' THEN
        next_day := (date_trunc('month', current_date_iter) + make_interval(days => effective_due_day - 1))::date;
        IF next_day >= current_date_iter AND next_day <= LEAST(generate_until, COALESCE(rec.ends_on, generate_until)) THEN
          INSERT INTO transactions (
            description, transaction_type, category_id, financial_entity_id,
            account_id, amount, competence_date, due_date, status,
            payee, notes, center_cost, source_type, source_id
          ) VALUES (
            rec.description, rec.transaction_type, rec.category_id,
            rec.financial_entity_id, rec.account_id, rec.amount,
            date_trunc('month', next_day)::date, next_day,
            CASE WHEN rec.generate_as_planned THEN 'planned' ELSE 'paid' END,
            rec.payee, rec.notes, rec.center_cost, 'recurrence', rec.id
          );
          rec_transactions_created := rec_transactions_created + 1;
          transactions_created := transactions_created + 1;
        END IF;
        current_date_iter := current_date_iter + interval '1 month';

      -- Weekly
      ELSIF rec.frequency = 'weekly' THEN
        IF rec.day_of_week IS NOT NULL THEN
          next_day := (current_date_iter + make_interval(days => (rec.day_of_week - EXTRACT(DOW FROM current_date_iter)::integer + 7) % 7))::date;
        ELSE
          next_day := current_date_iter;
        END IF;
        IF next_day <= LEAST(generate_until, COALESCE(rec.ends_on, generate_until)) THEN
          INSERT INTO transactions (
            description, transaction_type, category_id, financial_entity_id,
            account_id, amount, competence_date, due_date, status,
            payee, notes, center_cost, source_type, source_id
          ) VALUES (
            rec.description, rec.transaction_type, rec.category_id,
            rec.financial_entity_id, rec.account_id, rec.amount,
            date_trunc('month', next_day)::date, next_day,
            CASE WHEN rec.generate_as_planned THEN 'planned' ELSE 'paid' END,
            rec.payee, rec.notes, rec.center_cost, 'recurrence', rec.id
          );
          rec_transactions_created := rec_transactions_created + 1;
          transactions_created := transactions_created + 1;
          current_date_iter := next_day + interval '1 day';
        ELSE
          EXIT;
        END IF;

      -- Yearly
      ELSIF rec.frequency = 'yearly' THEN
        next_day := (date_trunc('year', current_date_iter) + make_interval(days => effective_due_day - 1))::date;
        IF next_day >= current_date_iter AND next_day <= LEAST(generate_until, COALESCE(rec.ends_on, generate_until)) THEN
          INSERT INTO transactions (
            description, transaction_type, category_id, financial_entity_id,
            account_id, amount, competence_date, due_date, status,
            payee, notes, center_cost, source_type, source_id
          ) VALUES (
            rec.description, rec.transaction_type, rec.category_id,
            rec.financial_entity_id, rec.account_id, rec.amount,
            date_trunc('month', next_day)::date, next_day,
            CASE WHEN rec.generate_as_planned THEN 'planned' ELSE 'paid' END,
            rec.payee, rec.notes, rec.center_cost, 'recurrence', rec.id
          );
          rec_transactions_created := rec_transactions_created + 1;
          transactions_created := transactions_created + 1;
        END IF;
        current_date_iter := current_date_iter + interval '1 year';
      END IF;

    END LOOP;

    -- Only update last_generated_until if we actually created transactions
    IF rec_transactions_created > 0 THEN
      UPDATE recurrences
      SET last_generated_until = LEAST(generate_until, COALESCE(rec.ends_on, generate_until))
      WHERE id = rec.id;
    END IF;

  END LOOP;

  RETURN transactions_created;
END;
$func$;

-- ============================================================
-- FIX 2: propagate_investment_month
-- Copies all investment snapshots from one month to the next:
--   - opening_value = previous closing_value
--   - closing_value = NULL (user fills in)
-- ============================================================
CREATE OR REPLACE FUNCTION public.propagate_investment_month(
  p_from_month date,
  p_to_month date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO investment_snapshots (
    reference_month,
    investment_class_id,
    financial_entity_id,
    opening_value,
    closing_value
  )
  SELECT
    p_to_month,
    investment_class_id,
    financial_entity_id,
    COALESCE(closing_value, opening_value, 0),
    NULL
  FROM investment_snapshots
  WHERE reference_month = p_from_month
  AND NOT EXISTS (
    SELECT 1 FROM investment_snapshots i2
    WHERE i2.reference_month = p_to_month
    AND i2.investment_class_id = investment_snapshots.investment_class_id
    AND i2.financial_entity_id = investment_snapshots.financial_entity_id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;

-- ============================================================
-- FIX 3: delete_last_investment_month
-- Deletes the most recent investment month (safety check: min 1 month)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_last_investment_month()
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_last_month date;
  v_count_months integer;
BEGIN
  SELECT COUNT(DISTINCT reference_month) INTO v_count_months
  FROM investment_snapshots;

  IF v_count_months <= 1 THEN
    RAISE EXCEPTION 'Não é possível excluir o único mês existente';
  END IF;

  SELECT MAX(reference_month) INTO v_last_month
  FROM investment_snapshots;

  DELETE FROM investment_snapshots
  WHERE reference_month = v_last_month;

  RETURN v_last_month;
END;
$func$;
