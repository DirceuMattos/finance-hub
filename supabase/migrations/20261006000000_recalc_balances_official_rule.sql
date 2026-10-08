-- CON-01: o recálculo de saldos chamado pelo app passa a seguir a regra oficial
-- (regras-saldo-bancario.md): saldo = abertura + lançamentos "paid" cuja data efetiva
-- coalesce(payment_date, competence_date, due_date) é posterior a opening_balance_date.
-- Antes usava competence_date >= p_from_date e ignorava data de pagamento e data-base,
-- podendo sobrescrever o saldo correto mantido pelo gatilho trg_apply_transaction_balance.
-- p_from_date é mantido só por compatibilidade com as chamadas do app (ignorado).
-- Em 06/10/2026 os dois cálculos coincidem em todas as contas: não deve mudar nenhum saldo.
-- Rollback: supabase/rollback/20261006000000_recalc_balances_official_rule.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.recalculate_account_balances_from_date(p_from_date date DEFAULT '2026-04-01'::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE accounts a
     SET current_balance = a.opening_balance + COALESCE((
           SELECT SUM(CASE WHEN t.transaction_type = 'income'  THEN t.amount
                           WHEN t.transaction_type = 'expense' THEN -t.amount
                           ELSE 0 END)
             FROM transactions t
            WHERE t.account_id = a.id
              AND t.status = 'paid'
              AND COALESCE(t.payment_date, t.competence_date, t.due_date)
                  > COALESCE(a.opening_balance_date, DATE '1900-01-01')
         ), 0)
   WHERE a.is_active = true;
END;
$function$;

-- Assertiva: após recalcular, toda conta ativa bate com a regra oficial.
DO $check$
DECLARE
  v_diff integer;
BEGIN
  PERFORM public.recalculate_account_balances_from_date();
  SELECT COUNT(*) INTO v_diff
    FROM accounts a
   WHERE a.is_active
     AND a.current_balance <> a.opening_balance + COALESCE((
           SELECT SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount
                           WHEN t.transaction_type = 'expense' THEN -t.amount ELSE 0 END)
             FROM transactions t
            WHERE t.account_id = a.id AND t.status = 'paid'
              AND COALESCE(t.payment_date, t.competence_date, t.due_date)
                  > COALESCE(a.opening_balance_date, DATE '1900-01-01')), 0);
  IF v_diff <> 0 THEN
    RAISE EXCEPTION 'Recálculo divergente em % conta(s)', v_diff;
  END IF;
  IF has_function_privilege('anon', 'public.recalculate_account_balances_from_date(date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Permissão anon indevida';
  END IF;
END;
$check$;

COMMIT;
