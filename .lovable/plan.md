

## Plano: Correção e aprimoramento do módulo Investimentos (7 itens)

### Diagnóstico

O módulo depende de duas views (`vw_investment_return_by_class` e `vw_investment_portfolio_summary`) que provavelmente **não existem** no banco externo. Isso causa:
- Cards de Aportes, Resgates e Carteira Total sempre zerados (itens 4 e 5)
- Filtros Pessoal/Empresarial vazios quando dependem dessas views (item 1)

Além disso, os entity IDs estão **hardcoded** na página, o que impede o filtro dinâmico. E o campo `closing_value` fica R$0,00 na listagem porque o registro do mês corrente foi criado apenas com `opening_value` (item 3).

### Solução

**Eliminar dependência das views** e calcular tudo a partir da tabela `investment_snapshots` diretamente no frontend.

---

### 1. Filtro Pessoal/Empresarial (item 1)
- Remover as constantes `PERSONAL_ENTITY_ID` e `BUSINESS_ENTITY_ID` hardcoded
- Buscar `financial_entities` com `entity_type` e filtrar dinamicamente por tipo (`personal`/`business`)

### 2. Filtro de meses (item 2)
- O dropdown de meses é gerado a partir dos snapshots. O `reference_month` é salvo como `YYYY-MM-DD`. O `fmtMonth` usa `new Date(m)` que pode falhar com timezone. Usar `parseISO` do date-fns para garantir parsing correto e exibir todos os meses disponíveis.

### 3. Closing value na listagem (item 3)
- Para cada snapshot do mês selecionado, buscar o `opening_value` do mês seguinte (mesmo `investment_class_id` + `financial_entity_id`) como "closing value efetivo"
- Se o registro tem `closing_value > 0`, usar esse valor; senão, usar o `opening_value` do mês seguinte
- Essa lógica será computada no `useMemo` que monta `filteredSnapshots`, cruzando com todos os snapshots disponíveis

### 4. Cards de totais (itens 4 e 5)
- **Remover** os hooks `useInvestmentReturnByClass` e `useInvestmentPortfolioSummary` (views inexistentes)
- Calcular diretamente dos snapshots:
  - **Carteira Total** = soma dos `closing_value` (efetivos) do mês selecionado
  - **Retorno Estimado** = soma de (closing - opening) do mês
  - **Aportes/Resgates**: como não há campos dedicados na tabela, substituir por cards mais úteis:
    - **Variação do Mês** = closing total - opening total
    - **Variação %** = (closing - opening) / opening * 100

### 5. Variação percentual por classe (item 6)
- Na seção de "Alocação por classe", adicionar o percentual de variação do mês:
  `((closing - opening) / opening * 100).toFixed(2)%`
- Exibir com cor verde/vermelho conforme positivo/negativo

### 6. Dashboard - investimentos (item 7)
- O `useDashboardData` já busca `investment_snapshots` diretamente (linhas 236-266) e calcula o total pelo `closing_value` do mês mais recente
- O problema é que `closing_value` está 0 nos registros. Aplicar a mesma lógica: se `closing_value === 0`, buscar `opening_value` do mês seguinte como proxy
- Isso corrige automaticamente o card "Total Investido" e o breakdown por classe no Dashboard

### 7. Gráfico de evolução
- Recalcular a partir dos snapshots agrupados por mês (sem depender de view)
- Cada ponto = soma dos closing values efetivos daquele mês

---

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useInvestments.ts` | Remover hooks de views inexistentes; adicionar helper `getEffectiveClosing` |
| `src/pages/Investimentos.tsx` | Remover entity IDs hardcoded; filtrar por entity_type dinâmico; recalcular cards/chart/allocation dos snapshots; adicionar variação % |
| `src/hooks/useDashboardData.ts` | Aplicar lógica de closing efetivo no cálculo de investimentos |

### Sem alterações no banco de dados

