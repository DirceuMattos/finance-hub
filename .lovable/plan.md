

## Plano: Auto-atualização do Dashboard ao lançar receitas/despesas

### Problema
O Dashboard usa `useQuery` do TanStack Query com cache padrão. Quando o usuário insere lançamentos em outras telas, o cache do Dashboard não é invalidado — os dados ficam desatualizados até o usuário recarregar a página.

### Solução
Duas ações complementares:

**1. Invalidar queries do Dashboard ao voltar para a página**
- Adicionar `refetchOnWindowFocus: true` (já é o padrão do React Query, mas garantir)
- Reduzir o `staleTime` das queries do Dashboard para que refetch automático ocorra ao navegar de volta

**2. Invalidar o cache do Dashboard após mutations de transações**
- No hook `useTransactions.ts`, as mutations `create`, `update` e `remove` já invalidam `["transactions"]`. Adicionar invalidação das query keys do Dashboard (`dashboard_*`) nessas mesmas mutations
- Fazer o mesmo no `useCardPurchases.ts` e `useRecurrences.ts`

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTransactions.ts` | Adicionar invalidação de queries `dashboard_*` no `onSuccess` de create/update/remove |
| `src/hooks/useCardPurchases.ts` | Idem — invalidar queries do dashboard |
| `src/hooks/useDashboardData.ts` | Definir `staleTime: 0` nas queries para garantir refetch ao revisitar |

### Detalhes técnicos
```typescript
// Em cada onSuccess das mutations:
queryClient.invalidateQueries({ queryKey: ["dashboard_monthly_flow_view"] });
queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
queryClient.invalidateQueries({ queryKey: ["dashboard_expenses_category"] });
queryClient.invalidateQueries({ queryKey: ["dashboard_cashflow_chart"] });
queryClient.invalidateQueries({ queryKey: ["dashboard_patrimony"] });
queryClient.invalidateQueries({ queryKey: ["dashboard_investments"] });
```

Isso garante que, ao criar/editar/excluir um lançamento e depois navegar ao Dashboard, os dados já estarão atualizados.

