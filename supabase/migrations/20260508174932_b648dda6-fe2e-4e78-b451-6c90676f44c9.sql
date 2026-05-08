-- Restrict investment_classes writes to admins only; reads remain for authenticated
DROP POLICY IF EXISTS auth_insert_investment_classes ON public.investment_classes;
DROP POLICY IF EXISTS auth_update_investment_classes ON public.investment_classes;
DROP POLICY IF EXISTS auth_delete_investment_classes ON public.investment_classes;

CREATE POLICY "Admins can insert investment classes"
ON public.investment_classes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update investment classes"
ON public.investment_classes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete investment classes"
ON public.investment_classes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin-only guard inside recalculate_account_balances and revoke from public
CREATE OR REPLACE FUNCTION public.recalculate_account_balances()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count integer := 0;
  acc RECORD;
  new_balance numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  FOR acc IN SELECT id FROM accounts WHERE is_active = true
  LOOP
    SELECT
      COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0)
    INTO new_balance
    FROM transactions t
    WHERE t.account_id = acc.id AND t.status = 'paid';

    new_balance := new_balance - COALESCE((
      SELECT SUM(ci.amount)
      FROM card_installments ci
      JOIN card_purchases cp ON cp.id = ci.card_purchase_id
      JOIN cards c ON c.id = cp.card_id
      WHERE c.account_id = acc.id AND ci.status = 'paid'
    ), 0);

    UPDATE accounts SET current_balance = new_balance WHERE id = acc.id;
    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.recalculate_account_balances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balances() TO authenticated;

-- Also guard the date-bounded variant if it exists
DO $$
DECLARE
  fn_oid oid;
BEGIN
  SELECT p.oid INTO fn_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'recalculate_account_balances_from_date'
  LIMIT 1;

  IF fn_oid IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.recalculate_account_balances_from_date(date) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.recalculate_account_balances_from_date(date) TO authenticated';
  END IF;
END $$;