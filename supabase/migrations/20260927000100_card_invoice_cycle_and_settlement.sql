-- CAR-01/02/03/04: regra única de fatura por ciclo de vencimento (opção A) e
-- quitação transacional. Não altera dados existentes.
-- Rollback: supabase/rollback/20260927000100_card_invoice_cycle_and_settlement.rollback.sql

BEGIN;

-- 1. Janela da fatura: dia seguinte ao vencimento de M-1 até o vencimento de M.
--    Espelha src/lib/cardCycle.ts. Com vencimento 25 o resultado é idêntico ao atual (26 a 25).
CREATE OR REPLACE FUNCTION public.card_cycle_bounds(p_month date, p_due_day integer)
RETURNS TABLE(cycle_start date, cycle_end date)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  WITH b AS (
    SELECT date_trunc('month', p_month)::date AS m0,
           (date_trunc('month', p_month) - interval '1 month')::date AS p0,
           CASE WHEN p_due_day BETWEEN 1 AND 31 THEN p_due_day ELSE 25 END AS d
  )
  SELECT
    (p0 + (LEAST(d, extract(day FROM (p0 + interval '1 month - 1 day'))::int) - 1)
        * interval '1 day' + interval '1 day')::date,
    (m0 + (LEAST(d, extract(day FROM (m0 + interval '1 month - 1 day'))::int) - 1)
        * interval '1 day')::date
  FROM b;
$fn$;

REVOKE EXECUTE ON FUNCTION public.card_cycle_bounds(date, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.card_cycle_bounds(date, integer) TO authenticated, service_role;

-- 2. Totais do ciclo por cartão (tela Cartões): mesma assinatura, janela pela regra única.
CREATE OR REPLACE FUNCTION public.get_card_cycle_totals(p_month date)
RETURNS TABLE(card_name text, card_id uuid, total_paid numeric, total_planned numeric,
              invoice_paid boolean, invoice_amount numeric, invoice_payment_date date)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    c.name AS card_name,
    c.id AS card_id,
    COALESCE(SUM(CASE WHEN t.status = 'paid'    THEN ABS(t.amount) ELSE 0 END), 0) AS total_paid,
    COALESCE(SUM(CASE WHEN t.status = 'planned' THEN ABS(t.amount) ELSE 0 END), 0) AS total_planned,
    (cip.id IS NOT NULL) AS invoice_paid,
    cip.amount_paid AS invoice_amount,
    cip.payment_date AS invoice_payment_date
  FROM cards c
  CROSS JOIN LATERAL public.card_cycle_bounds(p_month, COALESCE(c.due_day, 25)) w
  LEFT JOIN transactions t ON (
    t.center_cost = c.name
    AND t.due_date BETWEEN w.cycle_start AND w.cycle_end
    AND t.status IN ('paid', 'planned')
  )
  LEFT JOIN card_invoice_payments cip ON (
    cip.card_id = c.id
    AND cip.reference_month = date_trunc('month', p_month)::date
  )
  WHERE c.is_active = true
  GROUP BY c.name, c.id, cip.id, cip.amount_paid, cip.payment_date;
$fn$;

-- 3. Comprometimento de cartão do Dashboard: lançamentos pelo ciclo de vencimento.
--    Parcelas antigas (card_installments) seguem por billing_month, como hoje.
CREATE OR REPLACE FUNCTION public.get_card_month_total(p_start date, p_end date, p_entity_ids uuid[] DEFAULT NULL::uuid[])
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_install numeric := 0;
  v_transactions numeric := 0;
BEGIN
  SELECT COALESCE(SUM(ci.amount), 0)
    INTO v_install
    FROM card_installments ci
    JOIN card_purchases cp ON cp.id = ci.card_purchase_id
   WHERE ci.billing_month >= p_start
     AND ci.billing_month < p_end
     AND ci.status NOT IN ('paid', 'cancelled')
     AND (p_entity_ids IS NULL OR cp.financial_entity_id = ANY(p_entity_ids));

  SELECT COALESCE(SUM(t.amount), 0)
    INTO v_transactions
    FROM transactions t
    JOIN cards c ON c.name = t.center_cost AND c.is_active = true
    CROSS JOIN LATERAL public.card_cycle_bounds(p_start, COALESCE(c.due_day, 25)) ws
    CROSS JOIN LATERAL public.card_cycle_bounds((p_end - 1), COALESCE(c.due_day, 25)) we
   WHERE t.due_date BETWEEN ws.cycle_start AND we.cycle_end
     AND t.status NOT IN ('paid', 'cancelled')
     AND (p_entity_ids IS NULL OR t.financial_entity_id = ANY(p_entity_ids));

  RETURN v_install + v_transactions;
END;
$fn$;

-- 4. Quitação transacional da fatura. SECURITY INVOKER: respeita RLS do usuário.
--    p_settle:     [{"id": uuid, "account_id": uuid, "payment_date": "yyyy-mm-dd"}]
--    p_reschedule: [{"id": uuid, "due_date": "yyyy-mm-dd"}]  (opcional e explícito)
--    Lançamentos fora das duas listas não são tocados.
CREATE OR REPLACE FUNCTION public.settle_card_invoice(
  p_card_id uuid,
  p_reference_month date,
  p_settle jsonb DEFAULT '[]'::jsonb,
  p_reschedule jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_card record;
  v_start date;
  v_end date;
  v_month date := date_trunc('month', p_reference_month)::date;
  v_item jsonb;
  v_rows integer;
  v_settled integer := 0;
  v_rescheduled integer := 0;
  v_remaining integer;
  v_paid_total numeric;
  v_last_payment date;
  v_invoice_paid boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre novamente.';
  END IF;

  SELECT id, name, due_day INTO v_card FROM cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão não encontrado.';
  END IF;

  SELECT cycle_start, cycle_end INTO v_start, v_end
    FROM public.card_cycle_bounds(v_month, COALESCE(v_card.due_day, 25));

  IF jsonb_typeof(COALESCE(p_settle, '[]')) <> 'array' OR jsonb_typeof(COALESCE(p_reschedule, '[]')) <> 'array' THEN
    RAISE EXCEPTION 'Parâmetros inválidos.';
  END IF;

  -- Baixas item a item
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_settle, '[]')) LOOP
    IF (v_item->>'payment_date') IS NULL THEN
      RAISE EXCEPTION 'Informe a data de pagamento de todos os itens selecionados.';
    END IF;
    IF (v_item->>'account_id') IS NULL
       OR NOT EXISTS (SELECT 1 FROM accounts WHERE id = (v_item->>'account_id')::uuid AND is_active) THEN
      RAISE EXCEPTION 'Conta bancária inválida ou inativa em um dos itens.';
    END IF;

    UPDATE transactions
       SET status = 'paid',
           payment_date = (v_item->>'payment_date')::date,
           account_id = (v_item->>'account_id')::uuid
     WHERE id = (v_item->>'id')::uuid
       AND center_cost = v_card.name
       AND status = 'planned'
       AND due_date BETWEEN v_start AND v_end;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Um lançamento selecionado não está mais pendente nesta fatura. Atualize a tela e tente de novo.';
    END IF;
    v_settled := v_settled + 1;
  END LOOP;

  -- Reagendamentos explícitos
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_reschedule, '[]')) LOOP
    IF (v_item->>'due_date') IS NULL OR (v_item->>'due_date')::date <= v_end THEN
      RAISE EXCEPTION 'A nova data de vencimento deve ser posterior a %.', to_char(v_end, 'DD/MM/YYYY');
    END IF;

    UPDATE transactions
       SET due_date = (v_item->>'due_date')::date,
           competence_date = date_trunc('month', (v_item->>'due_date')::date)::date
     WHERE id = (v_item->>'id')::uuid
       AND center_cost = v_card.name
       AND status = 'planned'
       AND due_date BETWEEN v_start AND v_end;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Um lançamento a reagendar não está mais pendente nesta fatura. Atualize a tela e tente de novo.';
    END IF;
    v_rescheduled := v_rescheduled + 1;
  END LOOP;

  -- Situação da fatura após a operação
  SELECT COUNT(*) FILTER (WHERE status = 'planned'),
         COALESCE(SUM(ABS(amount)) FILTER (WHERE status = 'paid'), 0),
         MAX(payment_date) FILTER (WHERE status = 'paid')
    INTO v_remaining, v_paid_total, v_last_payment
    FROM transactions
   WHERE center_cost = v_card.name
     AND due_date BETWEEN v_start AND v_end;

  IF v_remaining = 0 AND v_paid_total > 0 THEN
    INSERT INTO card_invoice_payments (card_id, reference_month, due_date, amount_paid, payment_date)
    VALUES (v_card.id, v_month, v_end, v_paid_total, v_last_payment)
    ON CONFLICT (card_id, reference_month)
    DO UPDATE SET amount_paid = EXCLUDED.amount_paid,
                  payment_date = EXCLUDED.payment_date,
                  due_date = EXCLUDED.due_date,
                  updated_at = now();
    v_invoice_paid := true;
  END IF;

  RETURN jsonb_build_object(
    'settled', v_settled,
    'rescheduled', v_rescheduled,
    'remaining', v_remaining,
    'paid_total', v_paid_total,
    'invoice_paid', v_invoice_paid,
    'cycle_start', v_start,
    'cycle_end', v_end
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.settle_card_invoice(uuid, date, jsonb, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.settle_card_invoice(uuid, date, jsonb, jsonb) TO authenticated, service_role;

-- 5. Assertivas
DO $check$
DECLARE
  v_s date; v_e date;
BEGIN
  SELECT cycle_start, cycle_end INTO v_s, v_e FROM public.card_cycle_bounds(DATE '2026-09-01', 25);
  IF v_s <> DATE '2026-08-26' OR v_e <> DATE '2026-09-25' THEN
    RAISE EXCEPTION 'card_cycle_bounds(2026-09, 25) = % a %', v_s, v_e;
  END IF;
  SELECT cycle_start, cycle_end INTO v_s, v_e FROM public.card_cycle_bounds(DATE '2026-02-01', 31);
  IF v_s <> DATE '2026-02-01' OR v_e <> DATE '2026-02-28' THEN
    RAISE EXCEPTION 'card_cycle_bounds(2026-02, 31) = % a %', v_s, v_e;
  END IF;
  IF has_function_privilege('anon', 'public.settle_card_invoice(uuid, date, jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_card_cycle_totals(date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Permissão anon indevida após a migration.';
  END IF;
END;
$check$;

COMMIT;
