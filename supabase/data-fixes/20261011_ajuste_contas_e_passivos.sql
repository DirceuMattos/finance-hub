-- 11/10/2026 — autorizado pelo Dirceu.
-- PARTE A: ajuste de conciliação nas 7 contas com diferença pequena (tarifas/rendimentos não lançados).
--          Um lançamento pago por conta, em 11/10/2026, que leva o saldo do app ao saldo do extrato.
--          Desfazer: excluir os lançamentos "Ajuste de conciliação — extrato de 11/10/2026" em Lançamentos.
-- PARTE B: passivos no patrimônio (saldo devedor informado em 11/10/2026), lançados em set/2026.
--          Desfazer: DELETE FROM public.patrimony_snapshots WHERE notes = 'Saldo devedor informado em 11/10/2026';

-- ===================== PARTE A =====================
BEGIN;
DO $fix$
DECLARE v_cat uuid; r record; v_diff numeric; v_n integer := 0; v_bal numeric;
BEGIN
  SELECT id INTO v_cat FROM public.categories WHERE name = 'Ajuste de conciliação' LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.categories (name, category_group, transaction_nature)
    VALUES ('Ajuste de conciliação', 'variable', 'mixed') RETURNING id INTO v_cat;
  END IF;

  FOR r IN
    SELECT a.id, a.name, a.financial_entity_id, a.current_balance, x.app_esperado, x.extrato
      FROM (VALUES ('Aposenta - PF', 4943.79, 4992.12),
                   ('CEF - PJ',        68.96,   -55.07),
                   ('Sicoob - PJ',     52.16,    19.07),
                   ('Ítau - PJ',        0.00,    32.71),
                   ('CEF - PF',        16.02,    -9.58),
                   ('BRA Poup',       727.26,   723.37),
                   ('Nu-Bank - PF',     7.00,     7.40)) AS x(nome, app_esperado, extrato)
      JOIN public.accounts a ON a.name = x.nome AND a.is_active
  LOOP
    IF r.current_balance <> r.app_esperado THEN
      RAISE EXCEPTION 'Saldo de % mudou desde a conferência: % (esperado %). Nada foi alterado.', r.name, r.current_balance, r.app_esperado;
    END IF;
    v_diff := r.extrato - r.current_balance;
    INSERT INTO public.transactions (description, transaction_type, category_id, financial_entity_id, account_id, amount,
                                     competence_date, due_date, payment_date, status, source_type, notes)
    VALUES ('Ajuste de conciliação — extrato de 11/10/2026',
            CASE WHEN v_diff > 0 THEN 'income' ELSE 'expense' END,
            v_cat, r.financial_entity_id, r.id, abs(v_diff),
            DATE '2026-10-11', DATE '2026-10-11', DATE '2026-10-11', 'paid', 'manual',
            'Tarifas/rendimentos não lançados. Saldo no app ' || r.current_balance || ' -> extrato ' || r.extrato);
    SELECT current_balance INTO v_bal FROM public.accounts WHERE id = r.id;
    IF v_bal <> r.extrato THEN
      RAISE EXCEPTION 'Após o ajuste, % ficou com % (esperado %). Nada foi alterado.', r.name, v_bal, r.extrato;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  IF v_n <> 7 THEN RAISE EXCEPTION 'Esperadas 7 contas, encontradas %. Nada foi alterado.', v_n; END IF;
END;
$fix$;
COMMIT;

-- ===================== PARTE B =====================
BEGIN;
DO $fix$
DECLARE v_fin uuid; v_emp uuid; v_fis uuid; v_n integer;
  c_pf CONSTANT uuid := '7235f36b-97c2-4d9f-8467-3d205fc6952b'; -- Dirceu (pessoal)
  c_pj CONSTANT uuid := 'bc33f107-216c-455f-a698-89c847b7a393'; -- Infotekton (empresa)
BEGIN
  IF EXISTS (SELECT 1 FROM public.patrimony_snapshots WHERE notes = 'Saldo devedor informado em 11/10/2026') THEN
    RAISE EXCEPTION 'Passivos já lançados. Nada foi alterado.';
  END IF;
  IF (SELECT COUNT(*) FROM public.patrimony_snapshots WHERE reference_month = DATE '2026-09-01') <> 10 THEN
    RAISE EXCEPTION 'Set/2026 não tem os 10 itens esperados. Nada foi alterado.';
  END IF;

  SELECT id INTO v_fin FROM public.asset_categories WHERE name = 'Financiamentos' LIMIT 1;
  IF v_fin IS NULL THEN INSERT INTO public.asset_categories (name, asset_type) VALUES ('Financiamentos', 'liability') RETURNING id INTO v_fin; END IF;
  SELECT id INTO v_emp FROM public.asset_categories WHERE name = 'Empréstimos' LIMIT 1;
  IF v_emp IS NULL THEN INSERT INTO public.asset_categories (name, asset_type) VALUES ('Empréstimos', 'liability') RETURNING id INTO v_emp; END IF;
  SELECT id INTO v_fis FROM public.asset_categories WHERE name = 'Dívidas fiscais' LIMIT 1;
  IF v_fis IS NULL THEN INSERT INTO public.asset_categories (name, asset_type) VALUES ('Dívidas fiscais', 'liability') RETURNING id INTO v_fis; END IF;
  IF EXISTS (SELECT 1 FROM public.asset_categories WHERE id IN (v_fin, v_emp, v_fis) AND asset_type <> 'liability') THEN
    RAISE EXCEPTION 'Categoria de passivo com tipo diferente de liability. Nada foi alterado.';
  END IF;

  INSERT INTO public.patrimony_snapshots (reference_month, item_name, asset_category_id, financial_entity_id, opening_value, closing_value, notes) VALUES
    (DATE '2026-09-01', 'Financiamento Residencial',  v_fin, c_pf, 58000, 58000, 'Saldo devedor informado em 11/10/2026'),
    (DATE '2026-09-01', 'Consórcio - Carro',          v_fin, c_pf, 46000, 46000, 'Saldo devedor informado em 11/10/2026'),
    (DATE '2026-09-01', 'Parcelamento Receita Federal', v_fis, c_pf, 27000, 27000, 'Saldo devedor informado em 11/10/2026'),
    (DATE '2026-09-01', 'Empréstimo Sicoob',          v_emp, c_pj, 60000, 60000, 'Saldo devedor informado em 11/10/2026'),
    (DATE '2026-09-01', 'Empréstimo CEF - PRONAMPE',  v_emp, c_pj, 28000, 28000, 'Saldo devedor informado em 11/10/2026');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 5 THEN RAISE EXCEPTION 'Esperados 5 passivos, inseridos %', v_n; END IF;
END;
$fix$;
COMMIT;

-- ===================== CONFERÊNCIA =====================
SELECT 'conta' AS tipo, name AS item, current_balance AS valor FROM public.accounts
 WHERE name IN ('Aposenta - PF','CEF - PJ','Sicoob - PJ','Ítau - PJ','CEF - PF','BRA Poup','Nu-Bank - PF')
UNION ALL
SELECT 'passivo', p.item_name, p.closing_value FROM public.patrimony_snapshots p
 WHERE p.notes = 'Saldo devedor informado em 11/10/2026'
ORDER BY 1, 2;
