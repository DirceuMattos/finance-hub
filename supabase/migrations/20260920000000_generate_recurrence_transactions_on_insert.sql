-- Gera os lançamentos de uma nova recorrência na mesma transação do INSERT.
-- Se a geração falhar, a recorrência também não é gravada (sem estado parcial).

CREATE OR REPLACE FUNCTION public.generate_transactions_for_recurrence_internal(
  p_recurrence_id uuid,
  p_until date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  rec public.recurrences%ROWTYPE;
  v_generate_until date;
  v_occurrence date;
  v_month date;
  v_year integer;
  v_due_day integer;
  v_last_day integer;
  v_created integer := 0;
  v_inserted integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_recurrence_id::text, 0));

  SELECT *
    INTO rec
    FROM public.recurrences
   WHERE id = p_recurrence_id;

  IF NOT FOUND OR NOT rec.is_active OR rec.starts_on IS NULL THEN
    RETURN 0;
  END IF;

  v_generate_until := LEAST(
    COALESCE(p_until, (CURRENT_DATE + interval '12 months')::date),
    COALESCE(rec.ends_on, p_until, (CURRENT_DATE + interval '12 months')::date)
  );

  IF rec.starts_on > v_generate_until THEN
    RETURN 0;
  END IF;

  IF rec.frequency = 'monthly' THEN
    v_month := date_trunc('month', rec.starts_on)::date;
    v_due_day := COALESCE(rec.due_day, EXTRACT(DAY FROM rec.starts_on)::integer);

    WHILE v_month <= v_generate_until LOOP
      v_last_day := EXTRACT(
        DAY FROM (date_trunc('month', v_month) + interval '1 month' - interval '1 day')
      )::integer;
      v_occurrence := make_date(
        EXTRACT(YEAR FROM v_month)::integer,
        EXTRACT(MONTH FROM v_month)::integer,
        LEAST(v_due_day, v_last_day)
      );

      IF v_occurrence >= rec.starts_on AND v_occurrence <= v_generate_until THEN
        INSERT INTO public.transactions (
          description, transaction_type, category_id, financial_entity_id,
          account_id, amount, competence_date, due_date, status,
          payee, notes, center_cost, source_type, source_id
        )
        SELECT
          rec.description, rec.transaction_type, rec.category_id,
          rec.financial_entity_id, rec.account_id, rec.amount,
          date_trunc('month', v_occurrence)::date, v_occurrence,
          CASE WHEN rec.generate_as_planned THEN 'planned' ELSE 'paid' END,
          rec.payee, rec.notes, rec.center_cost, 'recurrence', rec.id
        WHERE NOT EXISTS (
          SELECT 1
            FROM public.transactions existing
           WHERE existing.source_type = 'recurrence'
             AND existing.source_id = rec.id
             AND existing.due_date = v_occurrence
        );
        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        v_created := v_created + v_inserted;
      END IF;

      v_month := (v_month + interval '1 month')::date;
    END LOOP;

  ELSIF rec.frequency = 'weekly' THEN
    v_occurrence := rec.starts_on;
    IF rec.day_of_week IS NOT NULL THEN
      v_occurrence := (
        v_occurrence
        + make_interval(
            days => (rec.day_of_week - EXTRACT(DOW FROM v_occurrence)::integer + 7) % 7
          )
      )::date;
    END IF;

    WHILE v_occurrence <= v_generate_until LOOP
      INSERT INTO public.transactions (
        description, transaction_type, category_id, financial_entity_id,
        account_id, amount, competence_date, due_date, status,
        payee, notes, center_cost, source_type, source_id
      )
      SELECT
        rec.description, rec.transaction_type, rec.category_id,
        rec.financial_entity_id, rec.account_id, rec.amount,
        date_trunc('month', v_occurrence)::date, v_occurrence,
        CASE WHEN rec.generate_as_planned THEN 'planned' ELSE 'paid' END,
        rec.payee, rec.notes, rec.center_cost, 'recurrence', rec.id
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.transactions existing
         WHERE existing.source_type = 'recurrence'
           AND existing.source_id = rec.id
           AND existing.due_date = v_occurrence
      );
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_created := v_created + v_inserted;
      v_occurrence := (v_occurrence + interval '7 days')::date;
    END LOOP;

  ELSIF rec.frequency = 'yearly' THEN
    v_year := EXTRACT(YEAR FROM rec.starts_on)::integer;

    WHILE make_date(v_year, 1, 1) <= v_generate_until LOOP
      v_last_day := EXTRACT(
        DAY FROM (
          date_trunc('month', make_date(v_year, EXTRACT(MONTH FROM rec.starts_on)::integer, 1))
          + interval '1 month' - interval '1 day'
        )
      )::integer;
      v_occurrence := make_date(
        v_year,
        EXTRACT(MONTH FROM rec.starts_on)::integer,
        LEAST(EXTRACT(DAY FROM rec.starts_on)::integer, v_last_day)
      );

      IF v_occurrence >= rec.starts_on AND v_occurrence <= v_generate_until THEN
        INSERT INTO public.transactions (
          description, transaction_type, category_id, financial_entity_id,
          account_id, amount, competence_date, due_date, status,
          payee, notes, center_cost, source_type, source_id
        )
        SELECT
          rec.description, rec.transaction_type, rec.category_id,
          rec.financial_entity_id, rec.account_id, rec.amount,
          date_trunc('month', v_occurrence)::date, v_occurrence,
          CASE WHEN rec.generate_as_planned THEN 'planned' ELSE 'paid' END,
          rec.payee, rec.notes, rec.center_cost, 'recurrence', rec.id
        WHERE NOT EXISTS (
          SELECT 1
            FROM public.transactions existing
           WHERE existing.source_type = 'recurrence'
             AND existing.source_id = rec.id
             AND existing.due_date = v_occurrence
        );
        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        v_created := v_created + v_inserted;
      END IF;

      v_year := v_year + 1;
    END LOOP;

  ELSE
    RAISE EXCEPTION 'Frequência de recorrência inválida: %', rec.frequency;
  END IF;

  IF v_created > 0 THEN
    UPDATE public.recurrences
       SET last_generated_until = GREATEST(
         COALESCE(last_generated_until, rec.starts_on),
         v_generate_until
       )
     WHERE id = rec.id;
  END IF;

  RETURN v_created;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_transactions_for_recurrence_internal(uuid, date)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_recurrence_transactions_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.generate_transactions_for_recurrence_internal(NEW.id, NULL);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_recurrence_transactions_after_insert()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS generate_recurrence_transactions_after_insert
  ON public.recurrences;

CREATE TRIGGER generate_recurrence_transactions_after_insert
AFTER INSERT ON public.recurrences
FOR EACH ROW
EXECUTE FUNCTION public.generate_recurrence_transactions_after_insert();

-- Também recupera uma recorrência antiga que ainda não possuía data inicial.
DROP TRIGGER IF EXISTS generate_recurrence_transactions_after_start_date
  ON public.recurrences;

CREATE TRIGGER generate_recurrence_transactions_after_start_date
AFTER UPDATE OF starts_on ON public.recurrences
FOR EACH ROW
WHEN (OLD.starts_on IS NULL AND NEW.starts_on IS NOT NULL)
EXECUTE FUNCTION public.generate_recurrence_transactions_after_insert();
