

## Plano: Corrigir desaparecimento de lançamentos após edição

### Causa raiz

No `TransactionForm.tsx`, ao carregar um lançamento para edição, as datas são convertidas assim:

```typescript
due_date: transaction.due_date ? new Date(transaction.due_date) : null,
payment_date: transaction.payment_date ? new Date(transaction.payment_date) : null,
```

`new Date("2026-01-15")` cria meia-noite UTC. No fuso do Brasil (UTC-3), isso vira 14/01 às 21h. Quando o formulário salva, `format(date, "yyyy-MM-dd")` usa hora local e grava `"2026-01-14"` — um dia a menos. Se a data original era dia 01, ela recua para o mês anterior, saindo do filtro.

### Correção

No `TransactionForm.tsx`, trocar `new Date(dateStr)` por parsing local:

```typescript
// Antes
due_date: transaction.due_date ? new Date(transaction.due_date) : null,

// Depois  
due_date: transaction.due_date
  ? (() => { const [y,m,d] = transaction.due_date.split('-').map(Number); return new Date(y, m-1, d); })()
  : null,
```

Mesma correção para `payment_date`. Isso cria o Date em meia-noite **local**, e `format()` devolve a data correta.

### Arquivo modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/lancamentos/TransactionForm.tsx` | Substituir `new Date(dateStr)` por parsing local para `due_date` e `payment_date` no `useEffect` de edição (linhas ~88-89) |

### Sem alterações no banco de dados

