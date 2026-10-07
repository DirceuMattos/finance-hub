-- Rollback da migration 20261006000000: restaura o recálculo por competence_date >= p_from_date.
-- Atenção: ao ser chamado pelo app, volta a ignorar data de pagamento e data-base.

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
    SELECT
      SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END) -
      SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END)
    FROM transactions t
    WHERE t.account_id = a.id
      AND t.status = 'paid'
      AND t.competence_date >= p_from_date
  ), 0)
  WHERE a.is_active = true;
END;
$function$;

COMMIT;
