

## Plano: Refinamento do Dashboard para Decisão Financeira Mensal

### Problema atual

1. **Cartões somam ALL-TIME** — a query de `cardSummary` busca todas as transactions sem filtro de mês, acumulando totais históricos completos
2. **Layout chapado** — 6 cards na mesma linha sem hierarquia visual
3. **Sem previsão de fechamento** — o indicador mais importante (resultado previsto do mês) não existe
4. **Sem cores semânticas** — verde/vermelho não são usados para positivo/negativo

### Alterações

**1. `src/hooks/useDashboardData.ts`**

- **Corrigir cardSummary**: filtrar por `competence_date` dentro do mês selecionado (usar `start`/`end`). Dentro do mês, separar "pago" (status=paid) vs "previsto" (status=planned) em vez do cutoff fixo
- **Adicionar previsão de fechamento**: novo campo `forecast` que calcula:
  - `income_paid + income_planned` (receitas realizadas + previstas)
  - `expense_paid + expense_planned` (despesas realizadas + previstas)
  - `forecast_result = total_income - total_expense`
  - Fonte: view `vw_monthly_cashflow_*` que já tem `income_planned`, `income_paid`, `expense_planned`, `expense_paid`
- Retornar `flow` completo (com planned + paid separados) em vez de apenas paid

**2. `src/pages/Dashboard.tsx`**

Layout reorganizado:

```text
[Filtros: Consolidado | Pessoal | Empresa] [Mês]

LINHA 1 — Operacional (4 cards):
[Saldo Atual] [Receitas do Mês] [Despesas do Mês] [Resultado do Mês]

LINHA 2 — Estrutural (2 cards):
[Patrimônio Total] [Total Investido]

BLOCO DESTAQUE — Previsão de Fechamento:
Card grande com:
  - Receitas (realizadas + previstas)
  - Despesas (realizadas + previstas)
  - Resultado previsto (verde se positivo, vermelho se negativo)

CARTÕES (filtrados pelo mês):
  - Pago no mês / Previsto no mês / Qtd lançamentos

TOP DESPESAS POR CATEGORIA

PATRIMÔNIO + INVESTIMENTOS (compacto, gráficos de linha + breakdown)
```

- **Cores semânticas**: valor positivo em `text-emerald-600`, negativo em `text-red-600`
- **StatCard**: adicionar prop `variant` (positive/negative/neutral) para colorir o valor
- **Resultado do mês** e **Previsão** com destaque visual (borda colorida ou background sutil)

**3. `src/components/shared/StatCard.tsx`**

- Adicionar prop `variant?: "positive" | "negative" | "neutral"` que aplica cor ao valor:
  - positive → `text-emerald-600`
  - negative → `text-red-600`
  - neutral → `text-foreground` (default)

### Queries alteradas

| Query | Antes | Depois |
|---|---|---|
| `cardSummary` | Todas as transactions all-time | Filtrado por `competence_date` do mês selecionado |
| `monthlyFlow` | Retorna apenas paid | Retorna `income_paid`, `income_planned`, `expense_paid`, `expense_planned` |
| Previsão | Não existia | `(income_paid + income_planned) - (expense_paid + expense_planned)` |

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/hooks/useDashboardData.ts` | Filtro mensal nos cartões, previsão de fechamento, flow completo |
| `src/pages/Dashboard.tsx` | Layout 2 linhas, bloco previsão, cores semânticas |
| `src/components/shared/StatCard.tsx` | Prop `variant` para cores |

Sem alteração no banco. Sem novas tabelas.

