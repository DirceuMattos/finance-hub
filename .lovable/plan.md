

## Plano: Atualização automática de saldos após baixa de lançamentos

### Contexto
Os triggers no banco externo já atualizam o `current_balance` das contas automaticamente. O trabalho é exclusivamente frontend: garantir que o cache de `accounts` seja invalidado após mudanças de status, e habilitar a ação de baixa em parcelas de cartão.

### Alterações

**1. `src/hooks/useTransactions.ts`**
- Adicionar `queryClient.invalidateQueries({ queryKey: ["accounts"] })` nos callbacks `onSuccess` de `create`, `update` e `remove`
- Isso garante que o saldo exibido no dashboard e nas telas reflita imediatamente o valor atualizado pelo trigger do banco

**2. `src/hooks/useCardPurchases.ts`**
- Adicionar `queryClient.invalidateQueries({ queryKey: ["accounts"] })` nos callbacks `onSuccess` de `create`, `update` e `remove`

**3. `src/pages/Lancamentos.tsx`**
- Remover a restrição "Somente leitura" para parcelas de cartão
- Adicionar botão de "Registrar Baixa" (ícone CheckCircle) para parcelas com status `pending`/`projected`/`open`
- Ao clicar, atualizar diretamente na tabela `card_installments` o status para `paid`
- Invalidar caches: `card_installments`, `card_purchases`, `card_billing_projection`, `accounts`, e todas as chaves `dashboard_*`

**4. Criar hook ou função auxiliar para atualizar status de parcelas de cartão**
- Adicionar uma mutation em `useCardInstallments.ts` (ou criar um novo hook) para fazer `supabase.from("card_installments").update({ status }).eq("id", id).select()`
- Com invalidação de `accounts`, `card_installments`, `card_billing_projection`, e chaves `dashboard_*`

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTransactions.ts` | Invalidar cache de `accounts` em create/update/remove |
| `src/hooks/useCardPurchases.ts` | Invalidar cache de `accounts` em create/update/remove |
| `src/hooks/useCardInstallments.ts` | Adicionar mutations de update (status) com invalidação de accounts |
| `src/pages/Lancamentos.tsx` | Habilitar ação de baixa em parcelas de cartão |

### Sem alterações no banco de dados
Os triggers já existem. O frontend apenas lê `accounts.current_balance`.

