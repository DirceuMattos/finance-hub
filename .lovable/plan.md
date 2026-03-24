

## Plano: Supabase como Fonte Única da Verdade

### Diagnóstico

O `useDashboardData.ts` atualmente faz **3 queries redundantes** em `transactions` que duplicam lógica já presente nas views:

| Dado | Hoje (frontend) | View disponível |
|---|---|---|
| Cartões (pago/previsto) | Query em `transactions` + filtro `center_cost` + agrupamento JS | `vw_card_billing_projection` + campos `projected_card_amount` na cashflow view |
| Risco/semáforo | Cálculo manual com regras JS | `traffic_light` já vem da cashflow view |
| Reserva mínima | Query em `system_parameters` | `minimum_reserve` já vem da cashflow view |
| Forecast | Cálculo manual paid+planned | `projected_balance` já vem da cashflow view |
| Contenção | Não usado | `potential_containment` na cashflow view + `vw_expense_containment` |

### Alterações

**1. `src/hooks/useDashboardData.ts` — Simplificar drasticamente**

- **Remover** query `cardSummary` (transactions com center_cost) → substituir por query a `vw_card_billing_projection`
- **Remover** query `systemParams` (system_parameters) → usar `minimum_reserve` da cashflow view
- **Remover** cálculo de `forecast` manual → usar `projected_balance` da cashflow view
- **Remover** cálculo de `riskLevel`/`riskMessage` → usar `traffic_light` da cashflow view
- **Remover** lógica `sanitizedFlow` (future month fix) → confiar nos dados da view
- **Manter** queries de `accounts` (saldo atual), `patrimony_snapshots`, `investment_snapshots`, `expensesByCategory` (não têm views dedicadas)
- **Adicionar** query a `vw_expense_containment` para alimentar dados de contenção

O hook passará a retornar:
- `flow`: direto da cashflow view (income_paid, expense_paid, income_planned, expense_planned, projected_card_amount, potential_containment, projected_balance, minimum_reserve, traffic_light)
- `cardSummary`: de `vw_card_billing_projection` (agrupado por cartão/mês)
- `riskData`: derivado do `traffic_light` da view (sem recalcular)

**2. `src/hooks/useMonthlyCashflow.ts` — Sem alteração**

Já usa as views corretamente.

**3. `src/pages/Dashboard.tsx` — Adaptar ao novo formato**

- Usar `traffic_light` da view para o semáforo (mapear green/yellow/red para Controlado/Atenção/Crítico)
- Usar `projected_balance` da view para previsão de fechamento
- Usar `projected_card_amount` da view no card de cartões
- Usar `potential_containment` para mostrar potencial de contenção
- Usar `minimum_reserve` da view no card de risco

**4. `src/pages/FaturasProjetadas.tsx` — Usar `vw_card_billing_projection`**

- Substituir a lógica de projeção manual por query à view `vw_card_billing_projection`

### Regra aplicada

Toda leitura analítica vem do banco. O frontend apenas:
1. Busca dados das views
2. Formata para exibição
3. Aplica filtros de UI (entidade, mês)

Zero lógica de negócio no frontend.

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/hooks/useDashboardData.ts` | Remover queries redundantes, usar views como fonte única |
| `src/pages/Dashboard.tsx` | Adaptar ao novo formato de dados (traffic_light, projected_balance da view) |
| `src/pages/FaturasProjetadas.tsx` | Usar `vw_card_billing_projection` |

