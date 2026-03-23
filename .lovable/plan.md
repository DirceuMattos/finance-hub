

## Plano: Corrigir consultas e garantir funcionamento de Configuracoes e Lancamentos

### 1. Corrigir `useDashboardData.ts`

Ajustar os nomes das colunas da view `vw_monthly_cashflow_consolidated` para os nomes reais:
- `total_income` → `income_paid`
- `total_expense` → `expense_paid`
- `net_balance` → `projected_balance`

Corrigir o filtro de mes:
- De: `.eq("reference_month", "2026-03")`
- Para: `.gte("reference_month", "2026-03-01").lt("reference_month", "2026-04-01")`

Usar `addMonths` do date-fns para calcular o proximo mes no filtro.

No cashflowChart query, corrigir os nomes das colunas no select e no tipo de retorno.

No fallback de transactions, manter a logica atual (nao depende da view).

### 2. Corrigir `useMonthlyCashflow.ts`

Atualizar a interface `MonthlyCashflow` para refletir os campos reais:
- `income_planned`, `income_paid`, `expense_planned`, `expense_paid`
- `projected_card_amount`, `potential_containment`
- `total_portfolio_value`, `investment_estimated_return`
- `projected_balance`, `minimum_reserve`, `traffic_light`

Remover `total_income`, `total_expense`, `net_balance`, `accumulated_balance`.

### 3. Corrigir `Dashboard.tsx`

Atualizar as referencias:
- `flow?.total_income` → `flow?.income_paid`
- `flow?.total_expense` → `flow?.expense_paid`
- `flow?.net_balance` → `flow?.projected_balance`

No chartData, mapear:
- `Receitas: d.income_paid`
- `Despesas: d.expense_paid`

### 4. Corrigir `FluxoMensal.tsx`

Atualizar as referencias de colunas na tabela e nos totais para usar os nomes reais (`income_paid`, `expense_paid`, `projected_balance`, `traffic_light`).

Exibir `traffic_light` como Badge colorido quando disponivel.

Adicionar colunas extras relevantes: `income_planned`, `expense_planned`, `projected_card_amount`.

### 5. Configuracoes e Lancamentos

Esses modulos ja estao implementados e funcionais — hooks CRUD, tabs, formularios e filtros ja existem. Precisam apenas da conexao ao Supabase externo (ja feita no passo anterior). Nenhuma alteracao necessaria nesses arquivos.

### Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardData.ts` | Nomes de colunas da view, filtro de mes por intervalo de data |
| `src/hooks/useMonthlyCashflow.ts` | Interface com campos reais da view |
| `src/pages/Dashboard.tsx` | Referencias aos novos nomes de campo |
| `src/pages/FluxoMensal.tsx` | Colunas da tabela e totais com nomes reais |

### Nenhuma tabela criada ou alterada

