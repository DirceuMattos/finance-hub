

## Plano: Corrigir Dashboard para usar views reais

### Problemas encontrados

| Problema | Causa |
|---|---|
| Query `vw_card_billing_projection` falha com erro 400 | Coluna `billing_month` não existe na view. A view existe mas está **vazia** (retorna `[]`) |
| Forecast recalculado no frontend | Linhas 122-134 recalculam `forecast_result` com soma manual em vez de usar `projected_balance` da view |
| Interface `CardBillingProjection` assume colunas fictícias | `card_name`, `billing_month`, `paid_amount`, `planned_amount` — nenhuma confirmada |

### Dados reais confirmados das views

**`vw_monthly_cashflow_consolidated`** (status 200, com dados):
- `reference_month`, `current_balance_base`, `income_planned`, `income_paid`, `expense_planned`, `expense_paid`, `projected_card_amount`, `potential_containment`, `total_portfolio_value`, `investment_estimated_return`, `projected_balance`, `minimum_reserve`, `traffic_light`

**`vw_card_billing_projection`** (status 200, mas vazia `[]`):
- Colunas desconhecidas — view sem dados para descobrir schema

**`vw_expense_containment`** (status 200, com dados):
- `reference_month`, `financial_entity_id`, `category_id`, `category_name`, `category_group`, `is_containable`, `total_amount`

### Alterações

**1. `src/hooks/useDashboardData.ts`**

- **Remover** query `cardBilling` e interface `CardBillingProjection` — view vazia e colunas desconhecidas
- **Remover** `cardSummary` derivado dessa query
- **Usar** `projected_card_amount` da cashflow view como dado de cartão (já vem calculado)
- **Usar** `projected_balance` da view diretamente como `forecast_result` — sem recalcular
- **Usar** `potential_containment` da view diretamente
- **Remover** cálculos manuais de `total_income`, `total_expense` no forecast
- Retornar `cardProjectedAmount` (número único do mês, vindo da view)

**2. `src/pages/Dashboard.tsx`**

- **Substituir** seção de cartões (cards individuais por cartão) por card único "Comprometimento com Cartão" usando `projected_card_amount` da view
- **Simplificar** bloco de Previsão: usar `income_paid`, `expense_paid`, `income_planned`, `expense_planned`, `projected_balance` direto da view
- **Remover** referências a `cardSummary` (array de cartões)

### Dados exibidos no Dashboard

| Indicador | Fonte |
|---|---|
| Saldo Atual | `accounts.current_balance` (query direta, sem view) |
| Receitas pagas | `flow.income_paid` da cashflow view |
| Despesas pagas | `flow.expense_paid` da cashflow view |
| Saldo projetado | `flow.projected_balance` da cashflow view |
| Cartão previsto | `flow.projected_card_amount` da cashflow view |
| Risco | `flow.traffic_light` da cashflow view |
| Reserva mínima | `flow.minimum_reserve` da cashflow view |
| Contenção | `flow.potential_containment` da cashflow view |
| Despesas por categoria | `transactions` (sem view dedicada) |
| Patrimônio | `patrimony_snapshots` (sem view dedicada) |
| Investimentos | `investment_snapshots` (sem view dedicada) |

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/hooks/useDashboardData.ts` | Remover cardBilling query, usar projected_balance direto, simplificar forecast |
| `src/pages/Dashboard.tsx` | Substituir seção de cartões individuais por card único com projected_card_amount |

Zero lógica de negócio no frontend. Zero colunas inventadas.

