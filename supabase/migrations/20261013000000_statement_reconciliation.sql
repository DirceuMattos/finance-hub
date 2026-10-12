-- Conciliação de extratos dentro do app (OFX/CSV), etapa 1.
-- O arquivo do banco NÃO é guardado: só o cabeçalho da importação, as linhas extraídas e as ações aprovadas.
-- Acesso: somente administrador (public.is_admin(), app_metadata.is_admin).
-- Rollback: 20261013000000_statement_reconciliation.rollback.sql

-- Conta do app reconhecida pelo arquivo (banco:conta do OFX)
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS statement_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_statement_ref_uq ON public.accounts (statement_ref) WHERE statement_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.statement_imports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  file_name          text NOT NULL,
  file_hash          text NOT NULL,
  source             text NOT NULL CHECK (source IN ('ofx', 'csv')),
  period_start       date,
  period_end         date,
  ledger_balance     numeric,
  ledger_date        date,
  line_count         integer NOT NULL DEFAULT 0,
  balance_before     numeric,
  balance_after      numeric,
  status             text NOT NULL DEFAULT 'aplicada' CHECK (status IN ('aplicada', 'desfeita')),
  created_by         uuid DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  undone_at          timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS statement_imports_hash_uq ON public.statement_imports (account_id, file_hash) WHERE status = 'aplicada';

CREATE TABLE IF NOT EXISTS public.statement_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id        uuid NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  line_date        date NOT NULL,
  amount           numeric NOT NULL,
  memo             text,
  fitid            text,
  match_status     text,
  transaction_ids  uuid[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS statement_lines_import_idx ON public.statement_lines (import_id);

CREATE TABLE IF NOT EXISTS public.reconciliation_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id       uuid NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  seq             integer NOT NULL,
  action          text NOT NULL CHECK (action IN ('create', 'settle', 'update_amount', 'cancel', 'adjust', 'rule')),
  transaction_id  uuid,
  rule_id         uuid,
  before          jsonb,
  after           jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reconciliation_actions_import_idx ON public.reconciliation_actions (import_id);

CREATE TABLE IF NOT EXISTS public.reconciliation_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern           text NOT NULL CHECK (length(trim(pattern)) >= 3),
  description       text NOT NULL,
  category_id       uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  transaction_type  text NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  account_id        uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_rules_uq
  ON public.reconciliation_rules (lower(pattern), coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Somente administrador
ALTER TABLE public.statement_imports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_rules   ENABLE ROW LEVEL SECURITY;

DO $p$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['statement_imports','statement_lines','reconciliation_actions','reconciliation_rules'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t || '_admin', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END;
$p$;

-- Aplica as ações aprovadas na tela, numa única transação, com registro do antes/depois.
-- p_import:  {account_id, file_name, file_hash, source, period_start, period_end, ledger_balance, ledger_date, statement_ref}
-- p_lines:   [{line_date, amount, memo, fitid, match_status, transaction_ids}]
-- p_actions: [{type:'create'|'adjust', date, amount(sinal), description, category_id}
--             {type:'settle', id, date} {type:'update_amount', id, amount(sinal)} {type:'cancel', id}
--             {type:'rule', pattern, description, category_id, transaction_type}]
CREATE OR REPLACE FUNCTION public.apply_statement_reconciliation(p_import jsonb, p_lines jsonb, p_actions jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_import_id uuid;
  v_account public.accounts%ROWTYPE;
  v_act jsonb;
  v_seq integer := 0;
  v_tx public.transactions%ROWTYPE;
  v_new_id uuid;
  v_amount numeric;
  v_adjust_cat uuid;
  v_rule_id uuid;
  v_rule_new boolean;
  v_note text;
  v_counts jsonb := '{}'::jsonb;
  v_sign integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente o administrador pode aplicar a conciliação.';
  END IF;

  SELECT * INTO v_account FROM public.accounts WHERE id = (p_import->>'account_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada.'; END IF;

  IF EXISTS (SELECT 1 FROM public.statement_imports
              WHERE account_id = v_account.id AND file_hash = p_import->>'file_hash' AND status = 'aplicada') THEN
    RAISE EXCEPTION 'Este arquivo já foi conciliado nesta conta.';
  END IF;

  INSERT INTO public.statement_imports (account_id, file_name, file_hash, source, period_start, period_end,
                                        ledger_balance, ledger_date, line_count, balance_before)
  VALUES (v_account.id, left(coalesce(p_import->>'file_name', 'extrato'), 200), p_import->>'file_hash', p_import->>'source',
          (p_import->>'period_start')::date, (p_import->>'period_end')::date,
          (p_import->>'ledger_balance')::numeric, (p_import->>'ledger_date')::date,
          coalesce(jsonb_array_length(p_lines), 0), v_account.current_balance)
  RETURNING id INTO v_import_id;

  INSERT INTO public.statement_lines (import_id, line_date, amount, memo, fitid, match_status, transaction_ids)
  SELECT v_import_id, l.line_date, l.amount, left(l.memo, 300), l.fitid, l.match_status, coalesce(l.transaction_ids, '{}')
    FROM jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb))
      AS l(line_date date, amount numeric, memo text, fitid text, match_status text, transaction_ids uuid[]);

  v_note := 'Conciliação de extrato: ' || left(coalesce(p_import->>'file_name', ''), 120);

  FOR v_act IN SELECT * FROM jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) LOOP
    v_seq := v_seq + 1;
    CASE v_act->>'type'
      WHEN 'create', 'adjust' THEN
        v_amount := (v_act->>'amount')::numeric;
        IF v_amount IS NULL OR v_amount = 0 THEN RAISE EXCEPTION 'Ação %: valor inválido.', v_seq; END IF;
        IF v_act->>'type' = 'adjust' THEN
          SELECT id INTO v_adjust_cat FROM public.categories WHERE name = 'Ajuste de conciliação' LIMIT 1;
          IF v_adjust_cat IS NULL THEN
            INSERT INTO public.categories (name, category_group, transaction_nature)
            VALUES ('Ajuste de conciliação', 'variable', 'mixed') RETURNING id INTO v_adjust_cat;
          END IF;
        END IF;
        INSERT INTO public.transactions (description, transaction_type, category_id, financial_entity_id, account_id, amount,
                                         competence_date, due_date, payment_date, status, source_type, notes)
        VALUES (left(coalesce(nullif(v_act->>'description', ''), 'Lançamento do extrato'), 200),
                CASE WHEN v_amount > 0 THEN 'income' ELSE 'expense' END,
                CASE WHEN v_act->>'type' = 'adjust' THEN v_adjust_cat ELSE nullif(v_act->>'category_id', '')::uuid END,
                v_account.financial_entity_id, v_account.id, abs(v_amount),
                (v_act->>'date')::date, (v_act->>'date')::date, (v_act->>'date')::date, 'paid', 'manual', v_note)
        RETURNING * INTO v_tx;
        INSERT INTO public.reconciliation_actions (import_id, seq, action, transaction_id, after)
        VALUES (v_import_id, v_seq, v_act->>'type', v_tx.id, to_jsonb(v_tx));

      WHEN 'settle' THEN
        SELECT * INTO v_tx FROM public.transactions WHERE id = (v_act->>'id')::uuid AND status = 'planned' FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Ação %: previsto não encontrado ou já baixado.', v_seq; END IF;
        INSERT INTO public.reconciliation_actions (import_id, seq, action, transaction_id, before)
        VALUES (v_import_id, v_seq, 'settle', v_tx.id, to_jsonb(v_tx));
        UPDATE public.transactions SET status = 'paid', payment_date = (v_act->>'date')::date, account_id = v_account.id
         WHERE id = v_tx.id;

      WHEN 'update_amount' THEN
        v_amount := (v_act->>'amount')::numeric;
        SELECT * INTO v_tx FROM public.transactions WHERE id = (v_act->>'id')::uuid AND status = 'paid' AND account_id = v_account.id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Ação %: lançamento não encontrado nesta conta.', v_seq; END IF;
        v_sign := CASE WHEN v_tx.transaction_type = 'income' THEN 1 ELSE -1 END;
        IF sign(v_amount) <> v_sign THEN
          RAISE EXCEPTION 'Ação %: o sinal do valor não confere com o tipo do lançamento.', v_seq;
        END IF;
        INSERT INTO public.reconciliation_actions (import_id, seq, action, transaction_id, before)
        VALUES (v_import_id, v_seq, 'update_amount', v_tx.id, to_jsonb(v_tx));
        UPDATE public.transactions SET amount = abs(v_amount) WHERE id = v_tx.id;

      WHEN 'cancel' THEN
        SELECT * INTO v_tx FROM public.transactions WHERE id = (v_act->>'id')::uuid AND status IN ('paid', 'planned') FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Ação %: lançamento não encontrado.', v_seq; END IF;
        INSERT INTO public.reconciliation_actions (import_id, seq, action, transaction_id, before)
        VALUES (v_import_id, v_seq, 'cancel', v_tx.id, to_jsonb(v_tx));
        UPDATE public.transactions SET status = 'cancelled', notes = concat_ws(' | ', notes, v_note) WHERE id = v_tx.id;

      WHEN 'rule' THEN
        SELECT id INTO v_rule_id FROM public.reconciliation_rules
         WHERE lower(pattern) = lower(trim(v_act->>'pattern')) AND account_id IS NOT DISTINCT FROM v_account.id;
        v_rule_new := v_rule_id IS NULL;
        IF v_rule_new THEN
          INSERT INTO public.reconciliation_rules (pattern, description, category_id, transaction_type, account_id)
          VALUES (trim(v_act->>'pattern'), left(v_act->>'description', 200), nullif(v_act->>'category_id', '')::uuid,
                  v_act->>'transaction_type', v_account.id)
          RETURNING id INTO v_rule_id;
        ELSE
          UPDATE public.reconciliation_rules
             SET description = left(v_act->>'description', 200), category_id = nullif(v_act->>'category_id', '')::uuid,
                 transaction_type = v_act->>'transaction_type', updated_at = now()
           WHERE id = v_rule_id;
        END IF;
        INSERT INTO public.reconciliation_actions (import_id, seq, action, rule_id, after)
        VALUES (v_import_id, v_seq, 'rule', v_rule_id, jsonb_build_object('created', v_rule_new));

      ELSE
        RAISE EXCEPTION 'Ação %: tipo desconhecido (%).', v_seq, v_act->>'type';
    END CASE;
    v_counts := jsonb_set(v_counts, ARRAY[v_act->>'type'], to_jsonb(coalesce((v_counts->>(v_act->>'type'))::int, 0) + 1));
  END LOOP;

  IF nullif(p_import->>'statement_ref', '') IS NOT NULL THEN
    UPDATE public.accounts SET statement_ref = p_import->>'statement_ref'
     WHERE id = v_account.id AND statement_ref IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.accounts a2 WHERE a2.statement_ref = p_import->>'statement_ref');
  END IF;

  PERFORM public.recalculate_account_balances_from_date('2026-04-01');
  UPDATE public.statement_imports SET balance_after = (SELECT current_balance FROM public.accounts WHERE id = v_account.id)
   WHERE id = v_import_id;

  RETURN jsonb_build_object(
    'import_id', v_import_id,
    'actions', v_counts,
    'balance_before', v_account.current_balance,
    'balance_after', (SELECT current_balance FROM public.accounts WHERE id = v_account.id)
  );
END;
$fn$;

-- Desfaz uma conciliação aplicada: ações em ordem inversa, saldos recalculados, linhas do extrato apagadas.
CREATE OR REPLACE FUNCTION public.undo_statement_reconciliation(p_import_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_imp public.statement_imports%ROWTYPE;
  r record;
  v_changed integer := 0;
  v_done integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente o administrador pode desfazer a conciliação.';
  END IF;
  SELECT * INTO v_imp FROM public.statement_imports WHERE id = p_import_id FOR UPDATE;
  IF NOT FOUND OR v_imp.status <> 'aplicada' THEN RAISE EXCEPTION 'Conciliação não encontrada ou já desfeita.'; END IF;

  FOR r IN SELECT * FROM public.reconciliation_actions WHERE import_id = p_import_id ORDER BY seq DESC LOOP
    IF r.action IN ('create', 'adjust') THEN
      IF EXISTS (SELECT 1 FROM public.transactions WHERE id = r.transaction_id AND updated_at > v_imp.created_at + interval '1 minute') THEN
        v_changed := v_changed + 1;
      END IF;
      DELETE FROM public.transactions WHERE id = r.transaction_id;
    ELSIF r.action IN ('settle', 'update_amount', 'cancel') THEN
      UPDATE public.transactions t
         SET status = r.before->>'status',
             payment_date = (r.before->>'payment_date')::date,
             account_id = (r.before->>'account_id')::uuid,
             amount = (r.before->>'amount')::numeric,
             notes = r.before->>'notes'
       WHERE t.id = r.transaction_id;
    ELSIF r.action = 'rule' AND coalesce((r.after->>'created')::boolean, false) THEN
      DELETE FROM public.reconciliation_rules WHERE id = r.rule_id;
    END IF;
    v_done := v_done + 1;
  END LOOP;

  DELETE FROM public.statement_lines WHERE import_id = p_import_id;
  UPDATE public.statement_imports SET status = 'desfeita', undone_at = now() WHERE id = p_import_id;
  PERFORM public.recalculate_account_balances_from_date('2026-04-01');

  RETURN jsonb_build_object('undone', v_done, 'changed_after_apply', v_changed,
                            'balance', (SELECT current_balance FROM public.accounts WHERE id = v_imp.account_id));
END;
$fn$;

REVOKE ALL ON FUNCTION public.apply_statement_reconciliation(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_statement_reconciliation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_statement_reconciliation(jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_statement_reconciliation(uuid) TO authenticated;
