-- Conciliação: (1) aceitar importação de extrato em PDF; (2) gravar no banco o saldo do extrato
-- digitado à mão na tela de Conciliação (antes ficava só no navegador e se perdia).
-- Rollback: 20261101000000_statement_pdf_and_manual_balance.rollback.sql
BEGIN;

-- 1. PDF como origem de importação
ALTER TABLE public.statement_imports DROP CONSTRAINT IF EXISTS statement_imports_source_check;
ALTER TABLE public.statement_imports
  ADD CONSTRAINT statement_imports_source_check CHECK (source IN ('ofx', 'csv', 'pdf'));

-- 2. Saldo do extrato informado manualmente, por conta e mês (último dia do mês)
CREATE TABLE IF NOT EXISTS public.account_statement_balances (
  account_id  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  month       date NOT NULL CHECK (month = date_trunc('month', month)::date),
  balance     numeric(14,2) NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid DEFAULT auth.uid(),
  PRIMARY KEY (account_id, month)
);

ALTER TABLE public.account_statement_balances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_statement_balances FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_statement_balances TO authenticated;

DROP POLICY IF EXISTS account_statement_balances_auth ON public.account_statement_balances;
-- Mesmo acesso dos lançamentos: qualquer usuário logado do sistema.
CREATE POLICY account_statement_balances_auth ON public.account_statement_balances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
