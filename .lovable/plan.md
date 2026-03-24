

## Plano: Dashboard Executivo com Dados Reais

### Visão geral

Evoluir o Dashboard existente para um painel executivo completo com 5 seções: Resumo Executivo, Cartões, Fluxo Mensal, Patrimônio e Investimentos. Usar exclusivamente dados já existentes no banco.

### Arquitetura de dados

| Seção | Fonte de dados | Queries |
|---|---|---|
| Resumo Executivo | `accounts`, `transactions`, `patrimony_snapshots`, `investment_snapshots` | Saldos, fluxo mensal, último snapshot |
| Cartões | `transactions` (center_cost) | Filtro por `CARD_INVOICE_CENTER_COSTS` |
| Fluxo Mensal | Views `vw_monthly_cashflow_*` | Já existente, manter |
| Patrimônio | `patrimony_snapshots`, `vw_patrimony_evolution` | Último mês + evolução |
| Investimentos | `investment_snapshots`, `investment_classes` | Último mês, agrupado por classe |

### Alterações por arquivo

**1. `src/hooks/useDashboardData.ts` — Expandir**

Adicionar novas queries ao hook existente:

- `accountBalancesSplit`: retornar saldo pessoal E empresarial separados (além do consolidado)
- `patrimonyTotal`: último mês de `patrimony_snapshots` → soma `closing_value` (filtrado por view)
- `investmentTotal`: último mês de `investment_snapshots` → soma `closing_value` (filtrado por view)
- `patrimonyByCategory`: breakdown do último mês por `asset_categories.name`
- `investmentByClass`: breakdown do último mês por `investment_classes.name`
- `patrimonyEvolution`: dados de `vw_patrimony_evolution` para gráfico de linha
- `cardSummary`: reusar lógica de `useCardInvoiceSummaryByCard` inline (totais histórico/futuro por cartão, usando `center_cost`)

Retornar tudo no objeto de retorno do hook.

**2. `src/pages/Dashboard.tsx` — Redesenhar layout**

Layout em seções verticais:

```text
[Filtros: Consolidado | Pessoal | Empresa] [Mês]

[Saldo Atual] [Receitas] [Despesas] [Saldo Mês] [Patrimônio] [Investido]
  (com sub-labels pessoal/empresa no saldo)

[Cartões - BRA Pessoal]     [Cartões - Nu Infotkt]
  Histórico: R$ X             Histórico: R$ X
  Previsto: R$ X              Previsto: R$ X
  Lançamentos: N              Lançamentos: N

[Fluxo Mensal - BarChart]   [Top Despesas por Categoria]

[Patrimônio - LineChart]    [Composição Patrimônio - barras horizontais]

[Investimentos por Classe - barras horizontais ou donut simplificado]
```

- Cores: verde para receitas/entradas, vermelho para despesas/saídas
- Formato monetário pt-BR
- Manter filtro de entidade (tabs) e mês (select)
- Seções de patrimônio e investimentos mostram "Sem dados" se snapshots estiverem vazios

**3. `src/components/shared/StatCard.tsx` — Adicionar suporte a sub-label**

Adicionar prop opcional `subLabel` para mostrar detalhamento (ex: "Pessoal: R$ X | Empresa: R$ Y") abaixo do valor principal.

### Regras de negócio aplicadas

- **Cartões via center_cost**: Usar `CARD_INVOICE_CENTER_COSTS` (singular e plural) do `cardInvoiceRules.ts`
- **Temporal**: `<= 2026-02-25` = histórico, `>= 2026-02-26` = futuro (somente UX, sem alterar status do banco)
- **Patrimônio**: Pegar o `reference_month` mais recente disponível em `patrimony_snapshots`
- **Investimentos**: Pegar o `reference_month` mais recente em `investment_snapshots`
- **Filtro por entidade**: Usar `financial_entity_id` em todas as queries quando view != consolidated

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/hooks/useDashboardData.ts` | Adicionar queries de patrimônio, investimentos, cartões, saldos split |
| `src/pages/Dashboard.tsx` | Layout executivo com 5 seções, gráficos de patrimônio e investimentos |
| `src/components/shared/StatCard.tsx` | Prop `subLabel` opcional |

Sem alteração no banco. Sem novas tabelas. Sem dados fictícios.

