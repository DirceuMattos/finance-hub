
## Correção de filtros e performance em Lançamentos

Ajustar o hook `src/hooks/useTransactions.ts` e a página `src/pages/Lancamentos.tsx` para resolver três problemas: filtro combinado mês+status retornando vazio, lentidão ao carregar "todos" os meses, e dependência desnecessária no `useMemo`.

### Alterações

**1. `src/hooks/useTransactions.ts`**

- Alterar assinatura: `useTransactions(filterMonth?: string, filterStatus?: string)`
- Atualizar `queryKey` para `["transactions", filterMonth, filterStatus]`
- Quando `filterStatus` estiver definido e diferente de `"all"`, aplicar `.eq("status", filterStatus)` na query do Supabase (filtro server-side)
- Quando `filterMonth` for `"all"` ou indefinido:
  - Reduzir `.limit(5000)` para `.limit(500)`
  - Manter ordenação por `competence_date` descendente (já é o padrão da query) para priorizar lançamentos mais recentes

**2. `src/pages/Lancamentos.tsx`**

- Passar o filtro de status ao hook: `useTransactions(filterMonth, filterStatus !== "all" ? filterStatus : undefined)`
- Remover do `useMemo` de `filtered` o trecho que filtra por status no cliente (agora é server-side)
- Remover `filterMonth` do array de dependências do `useMemo` de `filtered` (filtro já é server-side e não participa da lógica cliente)

### Resultado esperado

- Combinação "Mês + Status" passa a retornar resultados consistentes, pois ambos os filtros são aplicados no mesmo nível (servidor) sobre o mesmo critério de data já existente.
- Carregamento da visão "Todos os meses" fica significativamente mais rápido ao limitar a 500 registros mais recentes.
- `useMemo` de `filtered` não recalcula desnecessariamente ao trocar de mês.

### Detalhes técnicos

- Arquivos alterados: somente `src/hooks/useTransactions.ts` e `src/pages/Lancamentos.tsx`.
- Nenhuma mudança em banco de dados, RLS, rotas, componentes visuais, outros hooks ou cálculos do Dashboard.
- Resumo da listagem (`listSummary`) continua refletindo o conteúdo de `filtered` exibido em tela, agora já com os filtros aplicados pelo servidor.
