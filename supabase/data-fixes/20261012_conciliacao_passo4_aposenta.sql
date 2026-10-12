-- Aposenta-PF: os passos 2 e 3 trouxeram a Mesada Sophy (150,00, paga pela Aposenta) e tiraram o iPhone 2/21
-- (248,52, pago pela Nu-Bank PJ). O ajuste de 11/10 (+48,33) passa a -50,19 para o saldo voltar ao extrato (4.992,12).
-- Rollback: UPDATE public.transactions SET transaction_type = 'income', amount = 48.33 WHERE id = 'f383abc3-0a0a-4563-9c8c-8f65b8dca9f7';
--           SELECT public.recalculate_account_balances_from_date('2026-04-01');
BEGIN;
DO $fix$
DECLARE v_n integer; v_bal numeric;
BEGIN
  IF (SELECT current_balance FROM public.accounts WHERE name = 'Aposenta - PF') <> 5090.64 THEN
    RAISE EXCEPTION 'Saldo da Aposenta-PF mudou desde a conferência. Nada foi alterado.';
  END IF;
  UPDATE public.transactions
     SET transaction_type = 'expense', amount = 50.19,
         notes = concat_ws(' | ', notes, 'Conciliação com extrato em 12/10/2026 (passo 4): recalculado após Mesada Sophy e iPhone 2/21')
   WHERE id = 'f383abc3-0a0a-4563-9c8c-8f65b8dca9f7' AND transaction_type = 'income' AND amount = 48.33;
  GET DIAGNOSTICS v_n = ROW_COUNT; IF v_n <> 1 THEN RAISE EXCEPTION 'Ajuste da Aposenta não encontrado'; END IF;
  PERFORM public.recalculate_account_balances_from_date('2026-04-01');
  SELECT current_balance INTO v_bal FROM public.accounts WHERE name = 'Aposenta - PF';
  IF v_bal <> 4992.12 THEN RAISE EXCEPTION 'Aposenta-PF ficaria com %, esperado 4992.12', v_bal; END IF;
END;
$fix$;
COMMIT;

SELECT name, current_balance FROM public.accounts WHERE name = 'Aposenta - PF';
