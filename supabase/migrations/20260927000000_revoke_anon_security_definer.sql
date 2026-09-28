-- TRV-03: remove acesso sem login (anon) a funções SECURITY DEFINER e a tabelas
-- de importação sem RLS. Todas as rotas do app exigem login, então o app não
-- depende de anon. Não altera dados. Rollback:
-- supabase/rollback/20260927000000_revoke_anon_security_definer.rollback.sql

BEGIN;

-- 1. Funções SECURITY DEFINER: somente usuários autenticados (e service_role).
REVOKE EXECUTE ON FUNCTION public.delete_last_investment_month()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_last_patrimony_month()                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_transactions(date)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_card_cycle_totals(date)                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_card_month_total(date, date, uuid[])       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_card_total_by_card(date, date)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_daily_spending_pattern(text, integer)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_cashflow(text, integer)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propagate_investment_month(date, date)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propagate_patrimony_month(date, date)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_account_balances()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_account_balances_from_date(date)   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.delete_last_investment_month()                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_last_patrimony_month()                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_recurring_transactions(date)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_card_cycle_totals(date)                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_card_month_total(date, date, uuid[])        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_card_total_by_card(date, date)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_spending_pattern(text, integer)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_cashflow(text, integer)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.propagate_investment_month(date, date)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.propagate_patrimony_month(date, date)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balances()                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balances_from_date(date)    TO authenticated, service_role;

-- 2. search_path fixo nas duas SECURITY DEFINER que não tinham.
ALTER FUNCTION public.get_card_cycle_totals(date)               SET search_path = public;
ALTER FUNCTION public.get_daily_spending_pattern(text, integer) SET search_path = public;

-- 3. Tabelas de importação sem RLS e legíveis por anon (não usadas pelo app).
--    RLS ligado sem política = acesso negado pela API; SQL Editor (postgres) segue funcionando.
ALTER TABLE public.staging_lancamentos_cartoes_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_card_import_work               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_card_purchase_map              ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staging_lancamentos_cartoes_import FROM anon;
REVOKE ALL ON TABLE public.tmp_card_import_work               FROM anon;
REVOKE ALL ON TABLE public.tmp_card_purchase_map              FROM anon;

-- 4. Assertivas: qualquer divergência aborta tudo.
DO $check$
DECLARE
  v_fn integer;
  v_tb integer;
  v_auth integer;
BEGIN
  SELECT COUNT(*) INTO v_fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND has_function_privilege('anon', p.oid, 'EXECUTE')
     AND p.proname NOT IN ('is_admin', 'is_finance_admin');

  SELECT COUNT(*) INTO v_tb
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
     AND has_table_privilege('anon', c.oid, 'SELECT');

  SELECT COUNT(*) INTO v_auth
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('get_card_cycle_totals','get_card_month_total','get_daily_spending_pattern',
                       'get_monthly_cashflow','propagate_investment_month','propagate_patrimony_month',
                       'delete_last_patrimony_month','recalculate_account_balances_from_date')
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

  IF v_fn <> 0 OR v_tb <> 0 OR v_auth <> 8 THEN
    RAISE EXCEPTION 'TRV-03 inconsistente: fn_anon=%, tabelas_anon=%, fn_app_autenticado=% (esperado 0,0,8)',
      v_fn, v_tb, v_auth;
  END IF;
END;
$check$;

COMMIT;
