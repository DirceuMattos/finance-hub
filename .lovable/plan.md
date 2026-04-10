

## Plano: Botão "Recalcular Saldos" na aba Contas

### Objetivo
Adicionar um botão na aba Contas (Configurações) que recalcula o `current_balance` de todas as contas com base nos lançamentos comuns e de cartão realizados. O resultado se reflete imediatamente no Dashboard e demais telas.

### Implementação

**1. Criar função RPC no banco de dados (migration)**

Uma função `recalculate_account_balances()` que, para cada conta ativa:
- Soma receitas pagas (`transactions` com `transaction_type = income` e `status = paid`)
- Subtrai despesas pagas (`transactions` com `transaction_type = expense` e `status = paid`)
- Subtrai parcelas de cartão pagas (`card_installments` com `status = paid`, vinculadas à conta via `card_purchases` → `cards`)
- Atualiza `accounts.current_balance` com o valor calculado

Retorna o número de contas atualizadas.

**2. Alterar `AccountsTab.tsx`**

- Adicionar botão "Recalcular Saldos" (ícone RefreshCw) ao lado do botão "Nova"
- Ao clicar, chamar `supabase.rpc("recalculate_account_balances")`
- Mostrar loading no botão durante a execução
- Ao concluir, invalidar caches: `accounts`, `dashboard_account_balances_split` e demais chaves `dashboard_*`
- Exibir toast de sucesso/erro

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Criar função `recalculate_account_balances()` |
| `src/components/configuracoes/AccountsTab.tsx` | Adicionar botão e lógica de chamada RPC com invalidação de cache |

### Fluxo do usuário
1. Acessa Configurações → aba Contas
2. Clica em "Recalcular Saldos"
3. Sistema executa o cálculo no banco
4. Saldos atualizados aparecem na tabela e no Dashboard

