-- Conciliação com extratos (Nu-Bank PJ + caixinha + faturas Nu 4747, Itaú-PF, XP, BRA-PF) — PASSO 1.
-- Decisões do Dirceu em 12/10/2026. Cópia de tudo que é alterado/excluído em archive.conciliacao_20261012.
-- Rollback: ver 20261012_conciliacao_passo1.rollback.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated;

DO $fix$
DECLARE
  v_n integer; v_sum numeric;
  c_nupj CONSTANT uuid := 'cb1ad1eb-9b42-4f0b-b139-079c5bd5d856';
  c_bra  CONSTANT uuid := '32c74cda-2fcf-46a6-b5af-197a53a1e489';
  c_itpf CONSTANT uuid := 'f48f81d0-8272-420f-ad5d-38d024621665';
  c_xp   CONSTANT uuid := 'e0568091-9428-4f2a-8e28-73ec8f8a04c1';
  c_apo  CONSTANT uuid := '74a3d247-8a0f-4359-a550-9a4ec33062b0';
  e_pj   CONSTANT uuid := 'bc33f107-216c-455f-a698-89c847b7a393';
  e_pf   CONSTANT uuid := '7235f36b-97c2-4d9f-8467-3d205fc6952b';
  k_itau CONSTANT text := 'Itaú 2223 - Pessoal';
  k_nu   CONSTANT text := 'Nu Bank 4747 - Empresarial';
  nota   CONSTANT text := 'Conciliação com extrato em 12/10/2026';
BEGIN
  IF EXISTS (SELECT 1 FROM public.transactions WHERE notes LIKE nota || '%') THEN
    RAISE EXCEPTION 'Passo 1 já executado. Nada foi alterado.';
  END IF;

  -- Cópia para rollback de todas as linhas que este passo altera ou exclui
  EXECUTE format($q$CREATE TABLE archive.conciliacao_20261012 AS SELECT * FROM public.transactions WHERE
      (center_cost = %L AND status = 'paid' AND account_id IN (%L, %L) AND due_date BETWEEN '2026-07-26' AND '2026-09-25')
   OR (center_cost = %L AND status = 'planned' AND account_id = %L)
   OR id IN ('d14f768a-e687-4099-ac23-67152f55bf10','ec92693b-f31f-4c09-bf91-390462d22edf','35d1005d-f477-4539-b648-c9fc142274ab',
             '7ef40239-6838-4b0f-8f50-7971eb3a5d4d','c93e3034-cde6-4bee-8874-100e03094da2','bc2b8e8f-fc47-4eec-ad34-d23036a49322',
             'e9b13fa3-bcf2-42d8-bfac-d3e9cb54d767','17da84a2-bafb-4f36-bee0-03faf1caf461','cdee7252-fd9f-4bdf-b8ca-955ec831ab8c')
   OR (account_id = %L AND description = 'Seguro Residencial Bradesco' AND due_date = '2026-10-05' AND status = 'planned')
   OR (account_id = %L AND description = 'Aporte XP Investimentos para XP conta' AND amount = 500)$q$,
    k_itau, c_bra, c_itpf, k_itau, c_bra, c_bra, c_xp);
  REVOKE ALL ON archive.conciliacao_20261012 FROM PUBLIC, anon, authenticated;

  -- 1. Faturas Itaú 2223 de ago e set foram pagas pela Nu-Bank PJ: itens pagos na BRA-PF / Itaú-PF passam para a Nu-Bank PJ
  SELECT COUNT(*), SUM(amount) INTO v_n, v_sum FROM public.transactions
   WHERE center_cost = k_itau AND status = 'paid' AND account_id IN (c_bra, c_itpf) AND due_date BETWEEN '2026-07-26' AND '2026-09-25';
  IF v_n <> 61 OR v_sum <> 12179.50 THEN RAISE EXCEPTION '1: esperados 61 / 12179.50, encontrados % / %', v_n, v_sum; END IF;
  UPDATE public.transactions SET account_id = c_nupj, notes = concat_ws(' | ', notes, nota || ': fatura paga pela Nu-Bank PJ')
   WHERE center_cost = k_itau AND status = 'paid' AND account_id IN (c_bra, c_itpf) AND due_date BETWEEN '2026-07-26' AND '2026-09-25';

  -- 2. Faturas futuras do Itaú 2223: conta Aposenta-PF
  SELECT COUNT(*) INTO v_n FROM public.transactions WHERE center_cost = k_itau AND status = 'planned' AND account_id = c_bra;
  IF v_n <> 111 THEN RAISE EXCEPTION '2: esperados 111 previstos do Itaú na BRA-PF, encontrados %', v_n; END IF;
  UPDATE public.transactions SET account_id = c_apo WHERE center_cost = k_itau AND status = 'planned' AND account_id = c_bra;

  -- 3. Par que se anulava na Nu-Bank PJ (Pagto CC PF / reembo pgto CC via PJ): o pagamento agora está nos itens (passo 1)
  DELETE FROM public.transactions WHERE id IN ('d14f768a-e687-4099-ac23-67152f55bf10','ec92693b-f31f-4c09-bf91-390462d22edf')
    AND amount = 6095.11 AND account_id = c_nupj;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 2 THEN RAISE EXCEPTION '3: esperados 2, excluídos %', v_n; END IF;

  -- 4. Saída "Reembolsos BNP" 1.202,87 (25/08) espelhava a receita do reembolso; o banco só tem a entrada
  DELETE FROM public.transactions WHERE id = '35d1005d-f477-4539-b648-c9fc142274ab' AND amount = 1202.87 AND transaction_type = 'expense';
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '4: esperado 1, excluídos %', v_n; END IF;

  -- 5. Limpeza 28/08 duplicada: o banco tem um Pix de 660; ficam os 4 itens (110+110+220+220), sai o "Limpeza 660"
  DELETE FROM public.transactions WHERE id = '7ef40239-6838-4b0f-8f50-7971eb3a5d4d' AND amount = 660;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '5: esperado 1, excluídos %', v_n; END IF;

  -- 6. Água de ago e set foi paga pela Nu-Bank PJ (não pela BRA-PF)
  UPDATE public.transactions SET account_id = c_nupj
   WHERE id IN ('c93e3034-cde6-4bee-8874-100e03094da2','bc2b8e8f-fc47-4eec-ad34-d23036a49322') AND account_id = c_bra AND amount = 69.61;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 2 THEN RAISE EXCEPTION '6: esperados 2, alterados %', v_n; END IF;

  -- 7. Ajustes de valor pelo extrato
  UPDATE public.transactions SET amount = 1040.85 WHERE id = 'e9b13fa3-bcf2-42d8-bfac-d3e9cb54d767' AND amount = 1041.00;   -- IPVA (SEFAZ)
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '7a: IPVA não encontrado'; END IF;
  UPDATE public.transactions SET amount = 740.66, notes = concat_ws(' | ', notes, nota || ': encargos 709,30 + IOF 31,36')
   WHERE id = 'cdee7252-fd9f-4bdf-b8ca-955ec831ab8c' AND amount = 753.91;                                                     -- juros limite BRA set
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '7b: juros BRA não encontrado'; END IF;

  -- 8. "Upgrade aéreo" 102,00 está na fatura Nu 4747 (Latam 05/09), não no Itaú
  UPDATE public.transactions SET center_cost = k_nu WHERE id = '17da84a2-bafb-4f36-bee0-03faf1caf461' AND amount = 102 AND center_cost = k_itau;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '8: Upgrade aéreo não encontrado'; END IF;

  -- 9. Baixas que faltavam
  UPDATE public.transactions SET status = 'paid', payment_date = '2026-10-06'
   WHERE account_id = c_bra AND description = 'Seguro Residencial Bradesco' AND due_date = '2026-10-05' AND status = 'planned' AND amount = 64.51;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '9a: seguro BRA out não encontrado'; END IF;
  UPDATE public.transactions SET payment_date = '2026-08-19'
   WHERE account_id = c_xp AND description = 'Aporte XP Investimentos para XP conta' AND amount = 500 AND status = 'paid' AND payment_date IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION '9b: aporte XP não encontrado'; END IF;

  -- 10. Lançamentos que estão no extrato/fatura e faltavam no app
  INSERT INTO public.transactions (description, transaction_type, category_id, financial_entity_id, account_id, amount,
                                   competence_date, due_date, payment_date, status, source_type, center_cost, installment_number, installment_total, notes)
  VALUES
   -- Nu-Bank PJ
   ('Estacionamento - LITOPARK', 'expense', '601ba4b3-46b8-480e-8e96-5876d111d990', e_pj, c_nupj, 40.00, '2026-08-28', '2026-08-28', '2026-08-28', 'paid', 'manual', NULL, 1, 1, nota),
   ('Rendimento caixinha PJ (set/26)', 'income', 'e08f8eb1-2ffb-47a8-aa73-5240b1f3dc2a', e_pj, c_nupj, 35.06, '2026-09-30', '2026-09-30', '2026-09-30', 'paid', 'manual', NULL, 1, 1, nota),
   -- Fatura Nu 4747 (itens da fatura que não estavam no app)
   ('Latam (2/4)', 'expense', 'c812e16d-22ea-42f2-a15d-22d6f5253830', e_pj, c_nupj, 214.76, '2026-08-25', '2026-08-25', '2026-08-25', 'paid', 'manual', k_nu, 2, 4, nota || ': fatura Nu ago/26'),
   ('Latam (4/4)', 'expense', 'c812e16d-22ea-42f2-a15d-22d6f5253830', e_pj, c_nupj, 214.76, '2026-10-25', '2026-10-25', NULL, 'planned', 'manual', k_nu, 4, 4, nota || ': parcela futura'),
   ('Amazon - Cafoeshop', 'expense', NULL, e_pj, c_nupj, 497.00, '2026-09-25', '2026-09-25', '2026-09-25', 'paid', 'manual', k_nu, 1, 1, nota || ': fatura Nu set/26 (definir categoria)'),
   -- Itaú-PF (tarifas, seguros e juros do extrato)
   ('ITAU SEG VIDA PF (03/12)', 'expense', '4a67cdfd-449a-498c-9a10-26be55a3b953', e_pf, c_itpf, 296.86, '2026-08-17', '2026-08-17', '2026-08-17', 'paid', 'manual', NULL, 3, 12, nota),
   ('ITAU SEG VIDA PF (04/12)', 'expense', '4a67cdfd-449a-498c-9a10-26be55a3b953', e_pf, c_itpf, 296.86, '2026-09-15', '2026-09-15', '2026-09-15', 'paid', 'manual', NULL, 4, 12, nota),
   ('CAP PIC (13/60)', 'expense', 'f178ef3d-83ca-4146-87a0-863030b36e7c', e_pf, c_itpf, 92.48, '2026-09-10', '2026-09-10', '2026-09-10', 'paid', 'manual', NULL, 13, 60, nota),
   ('Juros limite da conta Itaú', 'expense', '59eaa66e-53dc-4209-96dd-ecdabc046437', e_pf, c_itpf, 44.05, '2026-09-10', '2026-09-10', '2026-09-10', 'paid', 'manual', NULL, 1, 1, nota),
   ('IOF Itaú', 'expense', '59eaa66e-53dc-4209-96dd-ecdabc046437', e_pf, c_itpf, 2.63, '2026-09-02', '2026-09-02', '2026-09-02', 'paid', 'manual', NULL, 1, 1, nota),
   ('IOF Itaú', 'expense', '59eaa66e-53dc-4209-96dd-ecdabc046437', e_pf, c_itpf, 3.78, '2026-10-02', '2026-10-02', '2026-10-02', 'paid', 'manual', NULL, 1, 1, nota),
   ('Seguro LIS Itaú', 'expense', '4a67cdfd-449a-498c-9a10-26be55a3b953', e_pf, c_itpf, 2.84, '2026-10-06', '2026-10-06', '2026-10-06', 'paid', 'manual', NULL, 1, 1, nota),
   -- BRA-PF
   ('Seguro Mais Proteção Bradesco', 'expense', '4a67cdfd-449a-498c-9a10-26be55a3b953', e_pf, c_bra, 2.86, '2026-09-08', '2026-09-08', '2026-09-08', 'paid', 'manual', NULL, 1, 1, nota),
   ('Seguro Mais Proteção Bradesco', 'expense', '4a67cdfd-449a-498c-9a10-26be55a3b953', e_pf, c_bra, 2.86, '2026-10-05', '2026-10-05', '2026-10-05', 'paid', 'manual', NULL, 1, 1, nota),
   ('Serviço Cartão Protegido Bradesco', 'expense', 'f178ef3d-83ca-4146-87a0-863030b36e7c', e_pf, c_bra, 9.99, '2026-09-10', '2026-09-10', '2026-09-10', 'paid', 'manual', NULL, 1, 1, nota),
   -- XP
   ('TED recebida de Dirceu Lopes de Mattos', 'income', NULL, e_pf, c_xp, 500.00, '2026-09-08', '2026-09-08', '2026-09-08', 'paid', 'manual', NULL, 1, 1, nota);
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 16 THEN RAISE EXCEPTION '10: esperados 16 lançamentos, inseridos %', v_n; END IF;

  -- 11. Recalcula os saldos de todas as contas pela regra oficial (troca de conta em lançamentos pagos)
  PERFORM public.recalculate_account_balances_from_date('2026-04-01');
END;
$fix$;
COMMIT;

-- Conferência: saldo no app x saldo do extrato em 12/10/2026
SELECT a.name AS conta, a.current_balance AS saldo_app, x.extrato, round(a.current_balance - x.extrato, 2) AS diferenca
  FROM public.accounts a
  JOIN (VALUES ('Nu-Bank - PJ', 4748.24), ('BRA - PF', -3993.92), ('Itaú - PF', -1060.41), ('XP - Digital', 35.23)) AS x(nome, extrato) ON x.nome = a.name
 ORDER BY 1;
