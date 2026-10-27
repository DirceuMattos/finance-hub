-- Desfaz 20261027_marcar_previsoes_cartao.sql: remove a tag previsao de todos os lançamentos.
-- Atenção: remove também marcações feitas depois pela tela (caixa "É previsão").
BEGIN;
UPDATE public.transactions
   SET tags = NULLIF(array_remove(tags, 'previsao'), '{}')
 WHERE tags @> ARRAY['previsao'];
COMMIT;
