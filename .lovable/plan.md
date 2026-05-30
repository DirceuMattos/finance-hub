## Objetivo

Alinhar o filtro de data do card "Despesas Previstas" e "Saldo Projetado" do Dashboard com a tela de Lançamentos, usando `due_date` como critério principal e `competence_date` apenas como fallback quando `due_date` for nulo.

## Escopo

Arquivo único: `src/hooks/useDashboardData.ts`

Apenas a query `monthlyFlow` (queryKey `dashboard_monthly_flow_view`), que alimenta `income_paid`, `income_planned`, `expense_paid`, `expense_planned`, `projected_balance` e `potential_containment` — ou seja, exatamente os campos consumidos pelos cards de Despesas Previstas e Saldo Projetado.

## Não alterar

- Query `expensesByCategory` (gráfico de categorias)
- Query `cashflowChart` (gráfico 12 meses)
- Query `cardMonthTotal` (RPC já corrigida)
- Qualquer outra query, componente ou cálculo

## Mudança técnica

Hoje (linhas ~85-89 de `useDashboardData.ts`):

```ts
let txQuery = (supabase as any)
  .from("transactions")
  .select("amount, transaction_type, status, financial_entity_id, center_cost")
  .neq("status", "cancelled")
  .gte("competence_date", start)
  .lt("competence_date", end);
```

Passa a ser:

```ts
let txQuery = (supabase as any)
  .from("transactions")
  .select("amount, transaction_type, status, financial_entity_id, center_cost, due_date, competence_date")
  .neq("status", "cancelled")
  .or(
    `and(due_date.gte.${start},due_date.lt.${end}),` +
    `and(due_date.is.null,competence_date.gte.${start},competence_date.lt.${end})`
  );
```

Isso replica exatamente o critério:

```
(due_date >= start AND due_date < end)
OR (due_date IS NULL AND competence_date >= start AND competence_date < end)
```

usando o filtro `.or()` do PostgREST.

Nenhum outro trecho do arquivo é tocado.
