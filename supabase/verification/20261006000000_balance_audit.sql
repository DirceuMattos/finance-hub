-- Auditoria de saldos (somente leitura) pela regra oficial. Esperado: diferenca = 0.00 em todas.
SELECT a.name AS conta,
       a.opening_balance_date AS data_base,
       a.opening_balance AS abertura,
       a.current_balance AS saldo_app,
       a.opening_balance + COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount
                                             WHEN t.transaction_type = 'expense' THEN -t.amount ELSE 0 END), 0) AS saldo_regra_oficial,
       a.current_balance - (a.opening_balance + COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount
                                             WHEN t.transaction_type = 'expense' THEN -t.amount ELSE 0 END), 0)) AS diferenca
  FROM accounts a
  LEFT JOIN transactions t
    ON t.account_id = a.id AND t.status = 'paid'
   AND COALESCE(t.payment_date, t.competence_date, t.due_date) > COALESCE(a.opening_balance_date, DATE '1900-01-01')
 WHERE a.is_active
 GROUP BY a.id
 ORDER BY a.name;
