-- CAR-02/04: fechamento explícito da fatura ("virar a fatura").
-- settle_card_invoice ganha p_close (padrão true = comportamento atual, compatível com o
-- frontend já publicado). O frontend novo envia p_close = false nas baixas e só fecha
-- quando o operador confirma na conferência. Não altera dados.
-- Rollback: supabase/rollback/20260928000000_card_invoice_explicit_close.rollback.sql

BEGIN;

DROP FUNCTION IF EXISTS public.settle_card_invoice(uuid, date, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.settle_card_invoice(
  p_card_id uuid,
  p_reference_month date,
  p_settle jsonb DEFAULT '[]'::jsonb,
  p_reschedule jsonb DEFAULT '[]'::jsonb,
  p_close boolean DEFAULT true
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

  -- Fechamento ("virar a fatura") só quando o operador confirma (p_close) e não há pendências.
  IF p_close AND v_remaining = 0 AND v_paid_total > 0 THEN
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

REVOKE EXECUTE ON FUNCTION public.settle_card_invoice(uuid, date, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.settle_card_invoice(uuid, date, jsonb, jsonb, boolean) TO authenticated, service_role;

DO $check$
BEGIN
  IF (SELECT COUNT(*) FROM pg_proc WHERE proname = 'settle_card_invoice') <> 1 THEN
    RAISE EXCEPTION 'Esperada exatamente 1 versão de settle_card_invoice';
  END IF;
  IF has_function_privilege('anon', 'public.settle_card_invoice(uuid, date, jsonb, jsonb, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Permissão anon indevida';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.settle_card_invoice(uuid, date, jsonb, jsonb, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated sem permissão';
  END IF;
END;
$check$;

COMMIT;
