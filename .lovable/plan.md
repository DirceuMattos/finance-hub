
## Correções críticas em saldos, filtros e mapeamento de status

Quatro ajustes pontuais para corrigir cálculo de saldos, filtros combinados, status de parcelas e visibilidade pós-salvamento. Apenas três arquivos serão modificados.

### 1. Saldos: usar função SQL `recalculate_account_balances` e recálculo automático

**`src/components/configuracoes/AccountsTab.tsx`**
- Substituir toda a lógica do `handleRecalculate` por uma chamada via `supabase.rpc("recalculate_account_balances")`.
- Após sucesso, invalidar `["accounts"]` e `["dashboard_account_balances_split"]`.
- Manter o estado `recalculating` e o tratamento de erro com `getUserErrorMessage`.

**`src/hooks/useTransactions.ts`**
- Adicionar função auxiliar `recalcBalances` que chama `supabase.rpc("recalculate_account_balances")` silenciosamente.
- Invocar `recalcBalances()` no `onSuccess` das três mutations (`create`, `update`, `remove`), antes das `invalidateQueries` existentes.

### 2. Filtro mês + status volta para client-side

**`src/hooks/useTransactions.ts`**
- Reverter assinatura para `useTransactions(filterMonth?: string)`.
- Remover `filterStatus` do `queryKey` e do filtro server-side (`.eq("status", ...)`).
- Manter o filtro de mês via `.or(...)` com `due_date` e `competence_date`.
- Manter o limite de 500 quando `filterMonth` for `"all"` ou indefinido.

**`src/pages/Lancamentos.tsx`**
- Voltar a chamada para `useTransactions(filterMonth)` (sem o segundo parâmetro).
- No `useMemo` de `filtered`, aplicar o filtro de status no cliente para TODAS as linhas (transações e parcelas de cartão), não apenas para parcelas:
  - `if (filterStatus !== "all" && t.status !== filterStatus) return false;`
- Reincluir `filterStatus` nas dependências do `useMemo`.

### 3. Mapeamento completo de status das parcelas de cartão

**`src/pages/Lancamentos.tsx`**
- No bloco `cardRows`, expandir o mapeamento de `status` para cobrir os valores `projected`, `pending` e `open` do banco, todos tratados como `"planned"`:
  ```ts
  status: inst.status === "paid" ? "paid"
    : inst.status === "cancelled" ? "cancelled"
    : inst.status === "projected" ? "planned"
    : inst.status === "pending" ? "planned"
    : inst.status === "open" ? "planned"
    : "planned",
  ```

### 4. `ensureSavedRecordVisible` não deve sobrescrever filtro de status

**`src/pages/Lancamentos.tsx`**
- Remover da função `ensureSavedRecordVisible` o bloco que reseta `filterStatus` para `"all"` quando o status do item salvo não bate com o filtro corrente.
- Os demais ajustes da função (mês, etc.) permanecem inalterados.
- Comportamento resultante: ao salvar um lançamento `paid` com filtro `planned` ativo, o item simplesmente não aparece — comportamento esperado.

### Resultado esperado
- "Recalcular Saldos" passa a refletir corretamente parcelas de cartão pagas, alinhado ao trigger SQL existente.
- Saldos das contas atualizam automaticamente após qualquer criação/edição/exclusão de lançamento.
- Combinação Mês + Status volta a retornar resultados consistentes (filtro server-side de mês + filtro client-side de status).
- Parcelas de cartão com status `projected`/`pending`/`open` aparecem corretamente sob o filtro "Previsto".
- Filtro de status escolhido pelo usuário permanece intacto após salvar um lançamento.

### Detalhes técnicos
- Arquivos alterados: `src/components/configuracoes/AccountsTab.tsx`, `src/hooks/useTransactions.ts`, `src/pages/Lancamentos.tsx`.
- Sem mudanças em banco de dados, RLS, rotas ou outros hooks.
- A função `recalculate_account_balances` já existe no banco (visível em `<db-functions>`) e tem `SECURITY DEFINER`, então roda sob permissão adequada via RPC autenticada.
- `listSummary` continua refletindo o conteúdo de `filtered` exibido em tela.
