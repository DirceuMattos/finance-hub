

## Plano: Corrigir constraint de status nos Lançamentos

### Causa raiz

O banco aceita apenas `planned`, `paid`, `cancelled` no campo `status` (check constraint `transactions_status_check`). O frontend usa `pending` em vários locais, causando o erro ao salvar.

Evidência no network log:
```
status: "pending" → erro 400: violates check constraint "transactions_status_check"
```

### Correções

**1. `src/components/lancamentos/TransactionForm.tsx`**
- Linha 51: default `status: "pending"` → `"planned"`
- Linha 86: reset default `status: "pending"` → `"planned"`
- Linha 155: `<SelectItem value="pending">` → `value="planned"`

**2. `src/pages/Lancamentos.tsx`**
- Linha 162/165: condição `r.status === "pending"` → remover (manter só `"planned"`)
- Linha 219: filtro `<SelectItem value="pending">` → `value="planned"`
- Linha 27 no StatusBadge: comentário sobre "pending" pode ficar como fallback mas não será usado

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/components/lancamentos/TransactionForm.tsx` | Trocar `pending` por `planned` no default, reset e select |
| `src/pages/Lancamentos.tsx` | Trocar `pending` por `planned` no filtro e nas condições de ação |

Sem alteração no banco.

