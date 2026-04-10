
CREATE OR REPLACE FUNCTION public.recalculate_account_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  acc RECORD;
  new_balance numeric;
BEGIN
  FOR acc IN SELECT id FROM accounts WHERE is_active = true
  LOOP
    SELECT
      COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0)
    INTO new_balance
    FROM transactions t
    WHERE t.account_id = acc.id AND t.status = 'paid';

    -- Subtract paid card installments linked to this account via cards
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
$$;
