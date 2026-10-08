-- INV-01: "propagar para o próximo mês" sobrescrevia meses que já existiam
-- (ON CONFLICT ... DO UPDATE SET closing_value = NULL), apagando o fechamento já lançado.
-- Foi o que zerou os fechamentos de abr, mai e jun/2026 em 22/07/2026.
-- Agora só cria as linhas que faltam no mês de destino; nunca altera linhas existentes.
-- Abertura do mês novo = fechamento do mês de origem (ou a abertura, se o mês ainda não fechou).
-- Rollback: supabase/rollback/20261006000200_safe_investment_propagation.rollback.sql

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
  IF p_to_month <= p_from_month THEN
    RAISE EXCEPTION 'O mês de destino deve ser posterior ao mês de origem';
  END IF;

  INSERT INTO investment_snapshots (
    reference_month, investment_class_id, financial_entity_id,
    opening_value, closing_value, has_quick_liquidity
  )
  SELECT
    p_to_month, s.investment_class_id, s.financial_entity_id,
    COALESCE(s.closing_value, s.opening_value, 0),
    NULL,
    s.has_quick_liquidity
  FROM investment_snapshots s
  WHERE s.reference_month = p_from_month
  ON CONFLICT (reference_month, investment_class_id, financial_entity_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

DO $check$
BEGIN
  IF has_function_privilege('anon', 'public.propagate_investment_month(date, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Permissão anon indevida';
  END IF;
  IF pg_get_functiondef('public.propagate_investment_month(date, date)'::regprocedure) LIKE '%DO UPDATE%' THEN
    RAISE EXCEPTION 'Função ainda sobrescreve meses existentes';
  END IF;
END;
$check$;

COMMIT;
