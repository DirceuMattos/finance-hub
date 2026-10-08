-- Rollback da migration 20261006000200 (volta o comportamento que sobrescreve meses existentes).
BEGIN;
CREATE OR REPLACE FUNCTION public.propagate_investment_month(p_from_month date, p_to_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO investment_snapshots (
    reference_month, investment_class_id, financial_entity_id,
    opening_value, closing_value
  )
  SELECT
    p_to_month, investment_class_id, financial_entity_id,
    COALESCE(closing_value, opening_value, 0),
    NULL
  FROM investment_snapshots
  WHERE reference_month = p_from_month
  ON CONFLICT (reference_month, investment_class_id, financial_entity_id)
  DO UPDATE SET
    opening_value = EXCLUDED.opening_value,
    closing_value = NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
COMMIT;
