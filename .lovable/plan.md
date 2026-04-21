
## Revisão e ajustes finais em Lançamentos, Dashboard e Recálculo de Saldos

A maior parte das correções solicitadas já está aplicada no código atual. Restam apenas dois ajustes reais (item #2 cosmético e item #4 de lógica) e nenhum outro arquivo será tocado.

### Estado atual (já correto, sem alteração)
- **#1** `useTransactions` já tem assinatura `(filterMonth?: string)` sem `filterStatus`; filtro de status já é aplicado client-side em `Lancamentos.tsx` (linha 254) para todas as linhas.
- **#3** `useDashboardData.monthlyFlow` já agrega `card_installments` exatamente como pedido: `paid` → `card_paid_amount`; demais (`projected`/`pending`/`open`) → `projected_card_amount`.
- **#5** `ensureSavedRecordVisible` já não contém o bloco que resetava `filterStatus`.

### Alterações a aplicar

**1. `src/pages/Lancamentos.tsx` — simplificar mapeamento de status das parcelas (item #2)**

No bloco `cardRows`, substituir a cascata atual de 5 ramos pela versão enxuta solicitada:

```ts
status: inst.status === "paid" ? "paid"
  : inst.status === "cancelled" ? "cancelled"
  : "planned",
```

Comportamento idêntico ao atual (`projected`/`pending`/`open`/qualquer outro caem em `"planned"`), apenas mais legível.

**2. `src/components/configuracoes/AccountsTab.tsx` — substituir RPC por recálculo client-side (item #4)**

Reescrever `handleRecalculate` para, em vez de chamar `rpc("recalculate_account_balances")`:
- Buscar contas ativas (`id`, `opening_balance`).
- Para cada conta, buscar transações `paid` (`transaction_type`, `amount`).
- Calcular `balance = opening_balance + Σ(income) − Σ(expense)` usando valores absolutos.
- Atualizar `accounts.current_balance` por conta.
- Ao final, invalidar `["accounts"]` e `["dashboard_account_balances_split"]`, exibir toast com a contagem de contas atualizadas.
- Manter o estado `recalculating` e o tratamento de erro com `getUserErrorMessage`.

Observação: este recálculo passa a desconsiderar parcelas pagas de cartão (que não têm `account_id` direto), conforme decisão explícita do usuário.

**3. `src/hooks/useTransactions.ts` — recálculo automático por conta após cada mutação (item #4)**

- Manter o helper `recalcBalances()` existente (chama `rpc`) — não remover, pois alguns invalidates já contam com ele.
- Adicionar, após cada `onSuccess` de `create`, `update` e `remove`, um IIFE assíncrono que:
  - Lê `account_id` do payload (`item` para create/update; sem efeito em remove pois o id já não existe — para `remove`, simplesmente pular se não houver `account_id` acessível).
  - Busca transações `paid` daquela conta.
  - Busca `opening_balance` da conta.
  - Recalcula `current_balance = opening_balance + Σ(income) − Σ(expense)`.
  - Atualiza `accounts.current_balance` para aquela conta.
  - Engole erros silenciosamente.
- Esse IIFE é executado em paralelo às `invalidateQueries` já existentes, sem `await`, conforme spec.
- Para a mutation `update`, o `account_id` precisa ser propagado do payload para o callback (atualmente o `mutationFn` desconstrói `id` mas não retorna `account_id`); usar a closure do payload original recebido por `useMutation` via `(_, variables)` no `onSuccess`.
- Para `remove`, o callback recebe apenas o `id`; nesse caso pular o recálculo por conta (continuar dependendo de `recalcBalances()` global).

### Resultado esperado
- Mapeamento de status de parcelas mais legível, sem mudança de comportamento.
- "Recalcular Saldos" passa a usar o cálculo client-side baseado em `opening_balance` + transações `paid` da própria conta.
- Após criar ou editar um lançamento, o saldo da conta envolvida é atualizado automaticamente pela mesma fórmula, sem depender da função SQL.
- Itens #1, #3 e #5 já estão atendidos pelo código atual e não serão modificados.

### Detalhes técnicos
- Arquivos alterados: somente `src/pages/Lancamentos.tsx`, `src/components/configuracoes/AccountsTab.tsx` e `src/hooks/useTransactions.ts`.
- Nenhuma mudança em banco de dados, RLS, edge functions, rotas ou outros hooks.
- O helper `recalcBalances()` (RPC) é mantido como rede de segurança adicional após mutações.
