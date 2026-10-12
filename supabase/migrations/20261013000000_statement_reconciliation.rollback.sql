-- Rollback da conciliação de extratos (etapa 1).
-- Atenção: apaga o histórico de importações, linhas, ações e regras aprendidas.
-- Os lançamentos criados/alterados pelas conciliações aplicadas NÃO são desfeitos por este rollback;
-- desfaça cada conciliação na tela (ou com undo_statement_reconciliation) antes, se for o caso.
BEGIN;
DROP FUNCTION IF EXISTS public.undo_statement_reconciliation(uuid);
DROP FUNCTION IF EXISTS public.apply_statement_reconciliation(jsonb, jsonb, jsonb);
DROP TABLE IF EXISTS public.reconciliation_rules;
DROP TABLE IF EXISTS public.reconciliation_actions;
DROP TABLE IF EXISTS public.statement_lines;
DROP TABLE IF EXISTS public.statement_imports;
DROP INDEX IF EXISTS public.accounts_statement_ref_uq;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS statement_ref;
COMMIT;
