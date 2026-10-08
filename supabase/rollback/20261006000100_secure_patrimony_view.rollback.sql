-- Rollback da migration 20261006000100 (volta a expor a view sem login; usar só em emergência).
BEGIN;
ALTER VIEW public.vw_patrimony_evolution RESET (security_invoker);
GRANT ALL ON public.vw_patrimony_evolution TO anon;
COMMIT;
