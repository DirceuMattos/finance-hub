-- Desfaz 20261101000000_statement_pdf_and_manual_balance.sql.
-- Atenção: apaga os saldos de extrato digitados. Se já houver importação em PDF aplicada,
-- desfaça-a na tela antes (a restrição antiga não aceita source = 'pdf').
BEGIN;
DROP TABLE IF EXISTS public.account_statement_balances;
ALTER TABLE public.statement_imports DROP CONSTRAINT IF EXISTS statement_imports_source_check;
ALTER TABLE public.statement_imports
  ADD CONSTRAINT statement_imports_source_check CHECK (source IN ('ofx', 'csv'));
COMMIT;
