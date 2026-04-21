
Objetivo: corrigir o card "Comprometimento Cartão" em `src/hooks/useDashboardData.ts` usando uma consulta dedicada para o total mensal de cartões, sem mexer em outros arquivos.

### O que será alterado

1. Manter a query `monthlyFlow` focada no fluxo mensal
- Preservar nela apenas os cálculos de receitas, despesas, saldo projetado, reserva mínima e risco.
- Não usar mais o valor calculado ali como fonte principal do total de cartões exibido no dashboard.

2. Adicionar uma nova query dedicada ao total de cartões do mês
- Inserir uma `useQuery` logo após `monthlyFlow` com chave:
  - `["dashboard_card_month_total", start, view]`
- Essa query ficará com:
  - `staleTime: 0`
  - `enabled: entitiesQuery.isFetched`
- Ela fará duas leituras:
  - `card_installments` filtrando por `billing_month` entre `start` e `end`
  - `transactions` filtrando por `competence_date` entre `start` e `end`, ignorando canceladas
- Em ambas, aplicará o filtro por entidade com `filterIds` quando a visão for pessoal ou empresarial.

3. Consolidar o total mensal de cartões em uma única métrica
- Somar os valores absolutos de:
  - parcelas de cartão vindas de `card_installments`
  - transações cujo `center_cost` esteja em `CARD_INVOICE_CENTER_COSTS`
- Retornar um único número da query: o total do mês para o card de comprometimento.

4. Passar a usar a nova query no `forecast`
- Alterar a montagem de `forecast` para que:
  - `projected_card_amount` use primeiro `cardMonthTotal.data`
  - mantenha `flow?.projected_card_amount ?? 0` apenas como fallback

5. Passar a usar a nova query no `riskData`
- Alterar `cardPlannedTotal` para usar:
  - `cardMonthTotal.data ?? flow?.projected_card_amount ?? 0`
- Assim, o indicador de risco e o card de comprometimento passam a apontar para a mesma fonte consolidada.

### Resultado esperado
- O valor de "Comprometimento Cartão" passa a vir de uma query específica e previsível.
- O cálculo deixa de depender do comportamento interno da query `monthlyFlow`.
- O total mensal de cartões fica alinhado com a lógica já usada no módulo de cartões, respeitando a separação por visão (Consolidado, Pessoal, Empresarial).

### Detalhes técnicos
- Arquivo único: `src/hooks/useDashboardData.ts`
- Reaproveitar o import já existente de `CARD_INVOICE_CENTER_COSTS`
- Não alterar `src/hooks/useCardInvoiceTransactions.ts`
- Não alterar rotas, componentes visuais, banco, hooks adicionais ou outros cálculos fora do escopo solicitado
