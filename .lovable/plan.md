## Objetivo
Adicionar `staleTime: 0` à `useQuery` em `src/hooks/useMonthlyCashflow.ts` para garantir busca sempre fresca.

## Mudança
Em `src/hooks/useMonthlyCashflow.ts`, linha 26, inserir `staleTime: 0,` entre `queryKey` e `queryFn`:

```typescript
return useQuery({
  queryKey: ["monthly_cashflow", view],
  staleTime: 0,
  queryFn: async () => {
```

Nenhum outro arquivo ou linha será alterado.