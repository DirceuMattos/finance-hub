-- SOMENTE LEITURA: lançamentos sem categoria (ou sem conta), para corrigir.
-- 1) Resumo por mês, tipo e status
SELECT to_char(coalesce(due_date, competence_date), 'YYYY-MM') AS mes,
       transaction_type AS tipo, status,
       count(*) AS qtd, round(sum(amount), 2) AS total
  FROM public.transactions
 WHERE category_id IS NULL AND status <> 'cancelled'
 GROUP BY 1, 2, 3
 ORDER BY 1 DESC, 2, 3;

-- 2) Lista para correção (mais recentes primeiro)
SELECT t.id, coalesce(t.due_date, t.competence_date) AS data, t.description AS descricao,
       t.transaction_type AS tipo, t.status, t.amount AS valor,
       a.name AS conta, t.center_cost AS cartao, t.source_type AS origem
  FROM public.transactions t
  LEFT JOIN public.accounts a ON a.id = t.account_id
 WHERE t.category_id IS NULL AND t.status <> 'cancelled'
 ORDER BY data DESC, t.description
 LIMIT 500;

-- 3) Descrições mais repetidas sem categoria (para corrigir em lote depois, com autorização)
SELECT t.description AS descricao, t.transaction_type AS tipo, count(*) AS qtd, round(sum(t.amount), 2) AS total
  FROM public.transactions t
 WHERE t.category_id IS NULL AND t.status <> 'cancelled'
 GROUP BY 1, 2
 ORDER BY qtd DESC
 LIMIT 50;
