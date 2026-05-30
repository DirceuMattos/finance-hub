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

  -- Fonte 2: transactions por competence_date (corrigido de due_date)
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