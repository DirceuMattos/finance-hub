-- Marca como "previsão" (tag previsao) os lançamentos de cartão ainda previstos que são estimativas:
-- APLICATIVOS (Asana, ChatGPT, Adobe, Discord, LinkedIn...) e Supermercado fora de recorrência.
-- Recorrências já contam como previsão sem marcação. Não altera valores, datas nem status.
-- Instrução única (sem tabela temporária): o resultado lista o que foi marcado.
-- Rollback: 20261027_marcar_previsoes_cartao.rollback.sql
UPDATE public.transactions t
   SET tags = array_append(COALESCE(t.tags, '{}'), 'previsao')
 WHERE t.status = 'planned'
   AND t.center_cost IS NOT NULL AND t.center_cost <> ''
   AND COALESCE(t.source_type, '') <> 'recurrence'
   AND NOT (COALESCE(t.tags, '{}') @> ARRAY['previsao'])
   AND (t.description ILIKE 'APLICATIVOS%' OR t.description ILIKE 'Supermercado%')
RETURNING t.center_cost, t.description, t.amount, t.due_date;
