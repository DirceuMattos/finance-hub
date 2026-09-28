-- Rollback da migration 20260927000000 (TRV-03). Restaura o estado anterior,
-- inclusive a exposição a anon. Usar só se o app quebrar após a migration.

BEGIN;

GRANT EXECUTE ON FUNCTION public.delete_last_investment_month()                 TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_last_patrimony_month()                  TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_transactions(date)          TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_card_cycle_totals(date)                    TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_card_month_total(date, date, uuid[])       TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_card_total_by_card(date, date)             TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_spending_pattern(text, integer)      TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_cashflow(text, integer)            TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propagate_investment_month(date, date)         TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propagate_patrimony_month(date, date)          TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balances()                 TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balances_from_date(date)   TO PUBLIC, anon;

ALTER FUNCTION public.get_card_cycle_totals(date)               RESET search_path;
ALTER FUNCTION public.get_daily_spending_pattern(text, integer) RESET search_path;

GRANT ALL ON TABLE public.staging_lancamentos_cartoes_import TO anon;
GRANT ALL ON TABLE public.tmp_card_import_work               TO anon;
GRANT ALL ON TABLE public.tmp_card_purchase_map              TO anon;
ALTER TABLE public.staging_lancamentos_cartoes_import DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_card_import_work               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_card_purchase_map              DISABLE ROW LEVEL SECURITY;

COMMIT;
