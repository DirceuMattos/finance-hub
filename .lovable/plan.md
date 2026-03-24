

## Plano: Corrigir 3 problemas no Dashboard

### Problemas identificados

1. **Gráfico de Fluxo Mensal inalterado** — O plano anterior pedia para substituir o gráfico de fluxo mensal pelo bloco de "Previsão de Fechamento", mas ambos coexistem. O gráfico de barras continua idêntico ao original.

2. **Totalizações ausentes em Patrimônio e Investimentos** — Os breakdowns horizontais mostram itens, mas não há valor total visível nos cards de "Composição do Patrimônio" e "Investimentos por Classe". Falta um total no topo de cada seção.

3. **Despesas "realizadas" em meses futuros** — Ao selecionar abril/2026, aparecem valores em "Despesas Realizadas". A causa: o `monthlyFlow` query usa a view `vw_monthly_cashflow_*`. Quando a view retorna dados para abril com `expense_paid > 0` (possivelmente por transações recorrentes já marcadas como "paid" em meses futuros), o Dashboard exibe sem questionar. Além disso, o fallback direto em `transactions` também não valida se o mês é futuro. 

   **Solução**: Para meses futuros (após o mês corrente), forçar `income_paid = 0` e `expense_paid = 0`, movendo tudo para `planned`. Isso é uma regra de UX — a view pode ter esses dados, mas no Dashboard não faz sentido exibir "realizado" para um mês que ainda não chegou.

### Alterações

**1. `src/pages/Dashboard.tsx`**

- **Remover o gráfico de Fluxo Mensal** (BarChart de receitas vs despesas) — já substituído pelo bloco de Previsão de Fechamento
- **Mover "Top Despesas por Categoria"** para ocupar largura total ou metade da tela
- **Adicionar total no topo** dos cards "Composição do Patrimônio" e "Investimentos por Classe" — exibir `patrimony.total` e `investment.total` como valor destacado antes do breakdown

**2. `src/hooks/useDashboardData.ts`**

- **Sanitizar dados de meses futuros**: se `selectedMonth > mês atual`, tratar `income_paid` e `expense_paid` da view como `planned` (somar aos respectivos planned, zerar paid). Isso garante que abril não mostra "Receitas Realizadas" nem "Despesas Realizadas".
- Lógica: comparar `start` com `format(startOfMonth(new Date()), "yyyy-MM-dd")` — se start > hoje, aplicar a correção.

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/pages/Dashboard.tsx` | Remover BarChart de fluxo, adicionar totais em patrimônio/investimentos |
| `src/hooks/useDashboardData.ts` | Sanitizar paid→planned para meses futuros |

Sem alteração no banco.

