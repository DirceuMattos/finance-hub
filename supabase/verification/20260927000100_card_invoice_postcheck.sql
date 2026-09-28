-- Pós-verificação SOMENTE LEITURA da migration 20260927000100.
-- Esperado: 2 funções novas; anon sem acesso; totais_set_2026 iguais aos da pré-verificação.
SELECT
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('settle_card_invoice', 'card_cycle_bounds')) AS funcoes_novas,
  has_function_privilege('anon', 'public.settle_card_invoice(uuid, date, jsonb, jsonb)', 'EXECUTE') AS anon_settle,
  has_function_privilege('authenticated', 'public.settle_card_invoice(uuid, date, jsonb, jsonb)', 'EXECUTE') AS auth_settle,
  (SELECT jsonb_agg(jsonb_build_object('card', card_name, 'paid', total_paid, 'planned', total_planned) ORDER BY card_name)
     FROM public.get_card_cycle_totals(DATE '2026-09-01')) AS totais_set_2026;
