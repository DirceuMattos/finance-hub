-- Marca como "previsão" (tag previsao) os lançamentos de cartão ainda previstos que são estimativas:
-- APLICATIVOS (Asana, ChatGPT, Adobe, Discord, LinkedIn...) e Supermercado fora de recorrência.
-- Recorrências já contam como previsão sem marcação. Não altera valores, datas nem status.
-- Rollback: 20261027_marcar_previsoes_cartao.rollback.sql
BEGIN;

CREATE TEMP TABLE _alvo ON COMMIT DROP AS
SELECT id
  FROM public.transactions
 WHERE status = 'planned'
   AND center_cost IS NOT NULL AND center_cost <> ''
   AND COALESCE(source_type, '') <> 'recurrence'
   AND NOT (COALESCE(tags, '{}') @> ARRAY['previsao'])
   AND (description ILIKE 'APLICATIVOS%' OR description ILIKE 'Supermercado%');

-- Conferência antes de gravar
SELECT t.center_cost, t.description, t.amount, t.due_date
  FROM public.transactions t JOIN _alvo a ON a.id = t.id
 ORDER BY t.center_cost, t.due_date, t.description;

UPDATE public.transactions t
   SET tags = array_append(COALESCE(t.tags, '{}'), 'previsao')
  FROM _alvo a
 WHERE a.id = t.id;

SELECT count(*) AS marcados FROM public.transactions WHERE tags @> ARRAY['previsao'];

COMMIT;
