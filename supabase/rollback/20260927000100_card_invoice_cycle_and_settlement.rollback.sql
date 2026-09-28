-- Rollback da migration 20260927000100. Restaura as definições vigentes em 27/09/2026
-- (já com as permissões do TRV-03) e remove as funções novas.
-- Não desfaz baixas feitas pelos usuários nem registros em card_invoice_payments:
-- são operações reais e continuam válidas com as funções antigas.

BEGIN;

DROP FUNCTION IF EXISTS public.settle_card_invoice(uuid, date, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.get_card_cycle_totals(p_month date)
RETURNS TABLE(card_name text, card_id uuid, total_paid numeric, total_planned numeric,
              invoice_paid boolean, invoice_amount numeric, invoice_payment_date date)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    c.name as card_name,
    c.id as card_id,
    COALESCE(SUM(CASE WHEN t.status = 'paid' THEN ABS(t.amount) ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN t.status = 'planned' THEN ABS(t.amount) ELSE 0 END), 0) as total_planned,
    (cip.id IS NOT NULL) as invoice_paid,
    cip.amount_paid as invoice_amount,
    cip.payment_date as invoice_payment_date
  FROM cards c
  LEFT JOIN transactions t ON (
    t.center_cost = c.name
    AND t.due_date >= (date_trunc('month', p_month) - interval '1 month' + interval '25 days')::date
    AND t.due_date <= (date_trunc('month', p_month) + make_interval(days => COALESCE(c.due_day, 25) - 1))::date
    AND t.status IN ('paid', 'planned')
  )
  LEFT JOIN card_invoice_payments cip ON (
    cip.card_id = c.id
    AND cip.reference_month = date_trunc('month', p_month)::date
  )
  WHERE c.is_active = true
  GROUP BY c.name, c.id, cip.id, cip.amount_paid, cip.payment_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_card_month_total(p_start date, p_end date, p_entity_ids uuid[] DEFAULT NULL::uuid[])
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_install numeric := 0;
  v_transactions numeric := 0;
BEGIN
  -- Fonte 1: card_installments por billing_month
  SELECT COALESCE(SUM(ci.amount), 0)
  INTO v_install
  FROM card_installments ci
  JOIN card_purchases cp ON cp.id = ci.card_purchase_id
  WHERE ci.billing_month >= p_start
    AND ci.billing_month < p_end
    AND ci.status NOT IN ('paid', 'cancelled')
    AND (p_entity_ids IS NULL OR cp.financial_entity_id = ANY(p_entity_ids));

  -- Fonte 2: transactions de cartão por competence_date
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_transactions
  FROM transactions t
  WHERE t.competence_date >= p_start
    AND t.competence_date < p_end
    AND t.status NOT IN ('paid', 'cancelled')
    AND t.center_cost IN (SELECT name FROM cards WHERE is_active = true)
    AND (p_entity_ids IS NULL OR t.financial_entity_id = ANY(p_entity_ids));

  RETURN v_install + v_transactions;
END;
$function$;

DROP FUNCTION IF EXISTS public.card_cycle_bounds(date, integer);

COMMIT;
