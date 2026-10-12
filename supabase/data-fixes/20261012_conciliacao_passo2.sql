-- Conciliação com extratos — PASSO 2 (decisões do Dirceu em 12/10/2026) e ajuste final por conta.
-- Pré-requisito: passo 1 executado. Cópia do que é alterado/excluído em archive.conciliacao2_20261012.
-- Rollback: ver 20261012_conciliacao_passo2.rollback.sql
BEGIN;
DO $fix$
DECLARE
  v_n integer; r record; v_bal numeric; v_diff numeric; v_cat uuid;
  c_nupj CONSTANT uuid := 'cb1ad1eb-9b42-4f0b-b139-079c5bd5d856';
  c_bra  CONSTANT uuid := '32c74cda-2fcf-46a6-b5af-197a53a1e489';
  c_apo  CONSTANT uuid := '74a3d247-8a0f-4359-a550-9a4ec33062b0';
  nota   CONSTANT text := 'Conciliação com extrato em 12/10/2026 (passo 2)';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE notes LIKE 'Conciliação com extrato em 12/10/2026%') THEN
    RAISE EXCEPTION 'Passo 1 não foi executado. Nada foi alterado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE notes LIKE nota || '%') THEN
    RAISE EXCEPTION 'Passo 2 já executado. Nada foi alterado.';
  END IF;

  EXECUTE format($q$CREATE TABLE archive.conciliacao2_20261012 AS SELECT * FROM public.transactions
    WHERE id IN ('ab976757-6f92-476c-af52-fb309a592f80','3f9837fa-cb70-441d-b675-3346d6e59472','3bf1badd-2bce-43ed-945e-43ff73ede77b',
                 'c734d449-8a9f-4130-a4a8-12ae489a9580','deee73b2-535d-4cf6-b93f-18c058cf7fb3')
       OR (account_id = %L AND description = 'Seguro Residencial Bradesco' AND status = 'planned' AND due_date IN ('2026-07-05','2026-08-05'))$q$, c_bra);
  REVOKE ALL ON archive.conciliacao2_20261012 FROM PUBLIC, anon, authenticated;

  -- 1 e 2. Sem correspondência no extrato nem na fatura Nu: excluir
  DELETE FROM public.transactions WHERE id = 'ab976757-6f92-476c-af52-fb309a592f80' AND amount = 107.97 AND account_id = c_nupj;  -- Frutas e Verduras 25/08
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '1: Frutas e Verduras não encontrado'; END IF;
  DELETE FROM public.transactions WHERE id = '3f9837fa-cb70-441d-b675-3346d6e59472' AND amount = 170.00 AND account_id = c_nupj;  -- Alimentação 27/08 (duplicado do cartão)
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '2: Alimentação 170 não encontrado'; END IF;

  -- 3. Alimentação 55,00 é a compra Ibis da fatura Nu 4747 (saldo não muda)
  UPDATE public.transactions SET center_cost = 'Nu Bank 4747 - Empresarial', due_date = '2026-09-25'
   WHERE id = '3bf1badd-2bce-43ed-945e-43ff73ede77b' AND amount = 55.00 AND center_cost IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '3: Alimentação 55 não encontrado'; END IF;

  -- 4. "App IA Reuniões" 293,53 previsto: vários itens somados num só; cancelar
  UPDATE public.transactions SET status = 'cancelled', notes = concat_ws(' | ', notes, nota || ': itens já lançados separadamente')
   WHERE id = 'c734d449-8a9f-4130-a4a8-12ae489a9580' AND status = 'planned' AND amount = 293.53;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '4: App IA Reuniões não encontrado'; END IF;

  -- 5. Mesada Sophy 05/10 foi paga pela Aposenta-PF
  UPDATE public.transactions SET account_id = c_apo WHERE id = 'deee73b2-535d-4cf6-b93f-18c058cf7fb3' AND account_id = c_bra AND amount = 150.00;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '5: Mesada Sophy não encontrada'; END IF;

  -- 6. Seguro residencial Bradesco de jul e ago foi pago
  UPDATE public.transactions SET status = 'paid', payment_date = due_date
   WHERE account_id = c_bra AND description = 'Seguro Residencial Bradesco' AND status = 'planned' AND due_date IN ('2026-07-05','2026-08-05') AND amount = 64.51;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 2 THEN RAISE EXCEPTION '6: esperados 2 seguros, alterados %', v_n; END IF;

  PERFORM public.recalculate_account_balances_from_date('2026-04-01');

  -- 7. Ajuste final: o que sobra vira um lançamento por conta, para o saldo ficar igual ao extrato de 12/10/2026
  SELECT id INTO v_cat FROM public.categories WHERE name = 'Ajuste de conciliação' LIMIT 1;
  IF v_cat IS NULL THEN RAISE EXCEPTION 'Categoria "Ajuste de conciliação" não encontrada'; END IF;
  FOR r IN
    SELECT a.id, a.name, a.financial_entity_id, x.extrato, x.ajuste_esperado
      FROM (VALUES ('Nu-Bank - PJ', 4748.24, 1093.31),
                   ('BRA - PF',    -3993.92, -5563.05),
                   ('Itaú - PF',   -1060.41, -534.13)) AS x(nome, extrato, ajuste_esperado)
      JOIN public.accounts a ON a.name = x.nome
  LOOP
    SELECT current_balance INTO v_bal FROM public.accounts WHERE id = r.id;
    v_diff := r.extrato - v_bal;
    IF abs(v_diff - r.ajuste_esperado) > 0.01 THEN
      RAISE EXCEPTION 'Ajuste de % diferente do conferido: % (esperado %). Nada foi alterado.', r.name, v_diff, r.ajuste_esperado;
    END IF;
    INSERT INTO public.transactions (description, transaction_type, category_id, financial_entity_id, account_id, amount,
                                     competence_date, due_date, payment_date, status, source_type, notes)
    VALUES ('Ajuste de conciliação — extrato de 12/10/2026', CASE WHEN v_diff > 0 THEN 'income' ELSE 'expense' END, v_cat,
            r.financial_entity_id, r.id, abs(v_diff), '2026-10-12', '2026-10-12', '2026-10-12', 'paid', 'manual',
            nota || ': diferenças anteriores a 13/08 (tarifas, juros, seguros e rendimentos não lançados) e faturas Itaú 2223 sem detalhe');
  END LOOP;

  PERFORM public.recalculate_account_balances_from_date('2026-04-01');
END;
$fix$;
COMMIT;

SELECT a.name AS conta, a.current_balance AS saldo_app, x.extrato, round(a.current_balance - x.extrato, 2) AS diferenca
  FROM public.accounts a
  JOIN (VALUES ('Nu-Bank - PJ', 4748.24), ('BRA - PF', -3993.92), ('Itaú - PF', -1060.41), ('XP - Digital', 35.23)) AS x(nome, extrato) ON x.nome = a.name
 ORDER BY 1;
