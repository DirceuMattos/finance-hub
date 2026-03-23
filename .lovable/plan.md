

## Diagnóstico: Por que o módulo de Cartões não exibe dados

### Causa raiz identificada

O hook `useCardInvoiceTransactions` filtra transações cujas categorias sejam exatamente:
- `"Cartões de Crédito - Pessoal"`
- `"Cartões de Crédito - Prof."`

**Essas categorias não existem no banco de dados.** A lista de categorias cadastradas não contém nenhuma entrada com esses nomes. Portanto, o filtro retorna zero transações, e tanto as barras de progresso dos cartões quanto as faturas projetadas ficam vazias.

### O que é necessário no banco (não no frontend)

Para que o módulo funcione como projetado, são necessários **dois passos no banco externo**:

**Passo 1 — Criar as categorias faltantes:**
```sql
INSERT INTO categories (name, category_group, transaction_nature, is_containable, is_active)
VALUES
  ('Cartões de Crédito - Pessoal', 'Despesa essencial', 'expense', false, true),
  ('Cartões de Crédito - Prof.', 'Despesa profissional', 'expense', false, true);
```

**Passo 2 — Vincular transações existentes a essas categorias:**

Se já existem lançamentos de fatura de cartão no banco mas com outra categoria (ou se precisam ser criados), eles devem ter `category_id` apontando para as novas categorias acima.

Exemplo: se existem lançamentos de pagamento de fatura do BRA Pessoal que hoje estão na categoria "DESP. BANCÁRIAS" ou outra, seria preciso atualizar o `category_id` deles para a categoria "Cartões de Crédito - Pessoal".

### Resumo

| Item | Estado |
|---|---|
| Frontend (hook, tela Cartões, Faturas) | Pronto e funcional |
| Categorias no banco | **Faltam** — "Cartões de Crédito - Pessoal" e "Cartões de Crédito - Prof." não existem |
| Transações vinculadas | **Nenhuma** transação usa essas categorias |
| Ação necessária | Criar categorias no banco externo e vincular transações |

### Alternativa

Se você preferir **não criar essas categorias** e em vez disso usar um critério diferente para identificar faturas de cartão (por exemplo, pela `account_id` ou `financial_entity_id` vinculada ao cartão), posso ajustar o mapeamento no frontend. Nesse caso, preciso saber qual critério usar para identificar uma transação como "fatura de cartão".

