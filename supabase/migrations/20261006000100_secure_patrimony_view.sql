-- TRV-04 (LGPD): vw_patrimony_evolution rodava com os privilégios do dono (postgres),
-- ignorando o RLS, e o papel anon (sem login) tinha SELECT: totais de patrimônio
-- ficavam legíveis com a chave pública do site. Passa a respeitar o RLS do usuário
-- e remove o acesso anon. Não altera dados. As demais views já usam security_invoker.
-- Rollback: supabase/rollback/20261006000100_secure_patrimony_view.rollback.sql

BEGIN;

ALTER VIEW public.vw_patrimony_evolution SET (security_invoker = true);
REVOKE ALL ON public.vw_patrimony_evolution FROM anon;
GRANT SELECT ON public.vw_patrimony_evolution TO authenticated, service_role;

DO $check$
BEGIN
  IF has_table_privilege('anon', 'public.vw_patrimony_evolution', 'SELECT') THEN
    RAISE EXCEPTION 'anon ainda lê vw_patrimony_evolution';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.vw_patrimony_evolution', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated sem acesso à view';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.vw_patrimony_evolution'::regclass
                 AND reloptions::text LIKE '%security_invoker=true%') THEN
    RAISE EXCEPTION 'security_invoker não aplicado';
  END IF;
END;
$check$;

COMMIT;
