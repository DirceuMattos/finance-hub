-- Conciliação — PASSO 3: faturas Itaú 3027 e 2223 de ago e set/2026 (pagas pela Nu-Bank PJ) item a item,
-- recálculo dos ajustes de conciliação e recorrências das tarifas fixas. Decisões do Dirceu em 12/10/2026.
-- Pré-requisito: passos 1 e 2 executados. Cópia em archive.conciliacao3_20261012. Rollback: ...passo3....rollback.sql
BEGIN;
DO $fix$
DECLARE
  v_n integer; r record; v_bal numeric; v_new numeric; v_signed numeric;
  c_nupj CONSTANT uuid := 'cb1ad1eb-9b42-4f0b-b139-079c5bd5d856';
  c_bra  CONSTANT uuid := '32c74cda-2fcf-46a6-b5af-197a53a1e489';
  c_itpf CONSTANT uuid := 'f48f81d0-8272-420f-ad5d-38d024621665';
  c_apo  CONSTANT uuid := '74a3d247-8a0f-4359-a550-9a4ec33062b0';
  e_pf   CONSTANT uuid := '7235f36b-97c2-4d9f-8467-3d205fc6952b';
  k_itau CONSTANT text := 'Itaú 2223 - Pessoal';
  nota   CONSTANT text := 'Conciliação com extrato em 12/10/2026 (passo 3)';
  aj_nupj CONSTANT uuid := '7a4c6658-1c11-44cf-b713-584ecbcdd34b';
  aj_bra  CONSTANT uuid := '04f0070b-251c-4dbb-aff4-560f89684204';
  aj_itpf CONSTANT uuid := '15331d12-0fcd-4371-b28a-c4aacf66dfd2';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE notes LIKE 'Conciliação com extrato em 12/10/2026 (passo 2)%') THEN
    RAISE EXCEPTION 'Passo 2 não foi executado. Nada foi alterado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE notes LIKE nota || '%') THEN
    RAISE EXCEPTION 'Passo 3 já executado. Nada foi alterado.';
  END IF;

  EXECUTE format($q$CREATE TABLE archive.conciliacao3_20261012 AS SELECT * FROM public.transactions
   WHERE id IN ('ea0558f6-f4e0-4af5-99ab-9dba46b8938e','b73602a8-4e2f-4dbb-81f0-28c316dd780a','3e69d631-9011-40cc-b372-ff0a2a1c2ba0',
                '7929a883-0d0b-45b0-809d-02ec4f2ca200','7d867399-d10c-4f2d-9db2-7d589b774915','40a4e392-6b49-4e4c-9db5-6c092f55475c',
                '12983b8e-b65b-49cc-8fba-fc1d03010e55','50ed2c2a-f175-4122-8951-6b87a9ae137c','afab4166-6225-4442-b2c7-e1f5b8d598d9',
                '1a5a189f-d43c-4014-967f-27a5c4895518','c6d74595-1469-49db-8580-b389d3691670','185893a5-aa2d-465e-9e95-043fa2ba746c',
                '798fdbe8-d922-46fb-921e-bab002abf637', %L, %L, %L)$q$, aj_nupj, aj_bra, aj_itpf);
  REVOKE ALL ON archive.conciliacao3_20261012 FROM PUBLIC, anon, authenticated;

  -- 1. Itens pagos em julho (fatura anterior, antes da PJ pagar): voltam para a conta original
  UPDATE public.transactions t SET account_id = o.account_id, notes = concat_ws(' | ', t.notes, nota || ': pago em julho, conta original')
    FROM archive.conciliacao_20261012 o
   WHERE o.id = t.id AND t.account_id = c_nupj
     AND t.id IN ('ea0558f6-f4e0-4af5-99ab-9dba46b8938e','b73602a8-4e2f-4dbb-81f0-28c316dd780a','3e69d631-9011-40cc-b372-ff0a2a1c2ba0','7929a883-0d0b-45b0-809d-02ec4f2ca200');
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 4 THEN RAISE EXCEPTION '1: esperados 4, alterados %', v_n; END IF;

  -- 2. Dr. Multas (4/10) e Recurso Detran (1/5) não estão nas faturas Itaú: pagos pela Aposenta-PF
  UPDATE public.transactions SET account_id = c_apo, notes = concat_ws(' | ', notes, nota || ': não consta nas faturas Itaú')
   WHERE id IN ('7d867399-d10c-4f2d-9db2-7d589b774915','40a4e392-6b49-4e4c-9db5-6c092f55475c') AND account_id = c_nupj;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 2 THEN RAISE EXCEPTION '2: esperados 2, alterados %', v_n; END IF;

  -- 3. iPhone (2/21) está na fatura Itaú 3027 de ago, paga pela Nu-Bank PJ
  UPDATE public.transactions SET account_id = c_nupj WHERE id = '12983b8e-b65b-49cc-8fba-fc1d03010e55' AND account_id = c_apo AND amount = 248.52;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '3: iPhone 2/21 não encontrado'; END IF;

  -- 4. Valores pelas faturas
  UPDATE public.transactions SET amount = 146.96 WHERE id IN ('50ed2c2a-f175-4122-8951-6b87a9ae137c','afab4166-6225-4442-b2c7-e1f5b8d598d9') AND amount = 146.97;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 2 THEN RAISE EXCEPTION '4a: material escolar'; END IF;
  UPDATE public.transactions SET amount = 79.99 WHERE id IN ('1a5a189f-d43c-4014-967f-27a5c4895518','c6d74595-1469-49db-8580-b389d3691670') AND amount = 80.00;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 2 THEN RAISE EXCEPTION '4b: LinkedIn'; END IF;
  UPDATE public.transactions SET amount = 135.60 WHERE id = '185893a5-aa2d-465e-9e95-043fa2ba746c' AND amount = 135.64;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '4c: Prime Video'; END IF;
  UPDATE public.transactions SET amount = 101.99 WHERE id = '798fdbe8-d922-46fb-921e-bab002abf637' AND amount = 102.06;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '4d: Chinelo e Bota'; END IF;

  -- 5. "Frutas e Verduras" 107,97 existe: FRUTARIA RINCAO 14/08 na fatura Itaú 3027 de ago (excluído no passo 2 por engano)
  INSERT INTO public.transactions SELECT * FROM archive.conciliacao2_20261012 WHERE id = 'ab976757-6f92-476c-af52-fb309a592f80';
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '5: Frutas e Verduras não está no arquivo'; END IF;
  UPDATE public.transactions SET center_cost = k_itau, due_date = '2026-08-25', payment_date = '2026-08-25', status = 'paid',
         notes = concat_ws(' | ', notes, nota || ': FRUTARIA RINCAO 14/08, fatura Itaú 3027')
   WHERE id = 'ab976757-6f92-476c-af52-fb309a592f80';

  -- 6. Itens das faturas que faltavam no app (pagos pela Nu-Bank PJ)
  INSERT INTO public.transactions (description, transaction_type, category_id, financial_entity_id, account_id, amount,
                                   competence_date, due_date, payment_date, status, source_type, center_cost, notes)
  VALUES
   ('APPLE.COM/BILL', 'expense', NULL, e_pf, c_nupj, 7.00, '2026-09-01', '2026-09-25', '2026-09-25', 'paid', 'manual', k_itau, nota || ': fatura Itaú 2223 set'),
   ('Encargos fatura Itaú 3027 (juros, multa, IOF)', 'expense', '59eaa66e-53dc-4209-96dd-ecdabc046437', e_pf, c_nupj, 71.17, '2026-08-01', '2026-08-25', '2026-08-25', 'paid', 'manual', k_itau, nota),
   ('Encargos fatura Itaú 2223 (juros, multa, IOF)', 'expense', '59eaa66e-53dc-4209-96dd-ecdabc046437', e_pf, c_nupj, 92.27, '2026-08-01', '2026-08-25', '2026-08-25', 'paid', 'manual', k_itau, nota),
   ('Encargos fatura Itaú 3027 (juros, multa, IOF)', 'expense', '59eaa66e-53dc-4209-96dd-ecdabc046437', e_pf, c_nupj, 85.43, '2026-09-01', '2026-09-25', '2026-09-25', 'paid', 'manual', k_itau, nota),
   ('Encargos fatura Itaú 2223 (juros, multa, IOF)', 'expense', '59eaa66e-53dc-4209-96dd-ecdabc046437', e_pf, c_nupj, 95.64, '2026-09-01', '2026-09-25', '2026-09-25', 'paid', 'manual', k_itau, nota);
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 5 THEN RAISE EXCEPTION '6: esperados 5, inseridos %', v_n; END IF;

  -- Conferência: itens das faturas Itaú pagos pela Nu-Bank PJ = valores pagos (ago 6.191,36; set 6.095,11)
  IF (SELECT SUM(amount) FROM public.transactions WHERE center_cost = k_itau AND status = 'paid' AND account_id = c_nupj AND due_date BETWEEN '2026-07-26' AND '2026-08-25') <> 6191.36 THEN
    RAISE EXCEPTION 'Fatura Itaú ago não fecha: %', (SELECT SUM(amount) FROM public.transactions WHERE center_cost = k_itau AND status = 'paid' AND account_id = c_nupj AND due_date BETWEEN '2026-07-26' AND '2026-08-25');
  END IF;
  IF (SELECT SUM(amount) FROM public.transactions WHERE center_cost = k_itau AND status = 'paid' AND account_id = c_nupj AND due_date BETWEEN '2026-08-26' AND '2026-09-25') <> 6095.11 THEN
    RAISE EXCEPTION 'Fatura Itaú set não fecha: %', (SELECT SUM(amount) FROM public.transactions WHERE center_cost = k_itau AND status = 'paid' AND account_id = c_nupj AND due_date BETWEEN '2026-08-26' AND '2026-09-25');
  END IF;

  PERFORM public.recalculate_account_balances_from_date('2026-04-01');

  -- 7. Recalcula os ajustes de conciliação para cada conta continuar igual ao extrato
  FOR r IN SELECT * FROM (VALUES (aj_nupj, c_nupj, 4748.24, 888.26), (aj_bra, c_bra, -3993.92, -5318.15), (aj_itpf, c_itpf, -1060.41, -335.13)) AS x(aj, conta, extrato, esperado) LOOP
    SELECT current_balance INTO v_bal FROM public.accounts WHERE id = r.conta;
    SELECT CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END INTO v_signed FROM public.transactions WHERE id = r.aj;
    v_new := v_signed + (r.extrato - v_bal);
    IF abs(v_new - r.esperado) > 0.01 THEN RAISE EXCEPTION 'Ajuste da conta % ficaria % (esperado %). Nada foi alterado.', r.conta, v_new, r.esperado; END IF;
    UPDATE public.transactions SET amount = abs(v_new), transaction_type = CASE WHEN v_new >= 0 THEN 'income' ELSE 'expense' END,
           notes = concat_ws(' | ', notes, nota || ': ajuste recalculado com as faturas Itaú')
     WHERE id = r.aj;
  END LOOP;
  PERFORM public.recalculate_account_balances_from_date('2026-04-01');

  -- 8. Recorrências das tarifas fixas (geram só lançamentos previstos)
  INSERT INTO public.recurrences (description, transaction_type, category_id, financial_entity_id, account_id, amount,
                                  frequency, due_day, starts_on, ends_on, is_continuous, is_active, generate_as_planned, notes)
  VALUES
   ('ITAU SEG VIDA PF', 'expense', '4a67cdfd-449a-498c-9a10-26be55a3b953', e_pf, c_itpf, 296.86, 'monthly', 15, '2026-10-15', '2027-05-15', false, true, true, nota || ': parcelas 5/12 a 12/12'),
   ('CAP PIC Itaú', 'expense', 'f178ef3d-83ca-4146-87a0-863030b36e7c', e_pf, c_itpf, 92.48, 'monthly', 10, '2026-10-10', '2030-08-10', false, true, true, nota || ': parcelas 14/60 a 60/60'),
   ('Seguro Mais Proteção Bradesco', 'expense', '4a67cdfd-449a-498c-9a10-26be55a3b953', e_pf, c_bra, 2.86, 'monthly', 5, '2026-11-05', NULL, true, true, true, nota);
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 3 THEN RAISE EXCEPTION '8: recorrências não criadas'; END IF;
END;
$fix$;
COMMIT;

SELECT a.name AS conta, a.current_balance AS saldo_app, x.extrato, round(a.current_balance - x.extrato, 2) AS diferenca
  FROM public.accounts a
  JOIN (VALUES ('Nu-Bank - PJ', 4748.24), ('BRA - PF', -3993.92), ('Itaú - PF', -1060.41), ('XP - Digital', 35.23)) AS x(nome, extrato) ON x.nome = a.name
UNION ALL
SELECT 'previstos gerados: ' || r.description, COUNT(t.*)::numeric, NULL, NULL
  FROM public.recurrences r LEFT JOIN public.transactions t ON t.source_type = 'recurrence' AND t.source_id = r.id
 WHERE r.notes LIKE 'Conciliação com extrato em 12/10/2026 (passo 3)%' GROUP BY r.description
ORDER BY 1;
