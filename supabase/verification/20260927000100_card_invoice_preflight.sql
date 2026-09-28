-- Pré-verificação SOMENTE LEITURA da migration 20260927000100.
-- Esperado: settle_card_invoice e card_cycle_bounds inexistentes; card_invoice_payments vazia;
-- totais atuais de set/2026 para comparação com a pós-verificação (devem ser iguais,
-- pois todos os cartões vencem no dia 25).
SELECT
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('settle_card_invoice', 'card_cycle_bounds')) AS funcoes_novas_existentes,
  (SELECT COUNT(*) FROM card_invoice_payments) AS pagamentos_fatura,
  (SELECT jsonb_agg(jsonb_build_object('card', card_name, 'paid', total_paid, 'planned', total_planned) ORDER BY card_name)
     FROM public.get_card_cycle_totals(DATE '2026-09-01')) AS totais_set_2026,
  (SELECT jsonb_agg(DISTINCT due_day) FROM cards) AS dias_vencimento;
