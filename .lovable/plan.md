

## Plano: Usar `center_cost` para identificar faturas de cartão

### Diagnóstico

As transações no banco **não usam** as categorias "Cartões de Crédito - Pessoal" / "Cartões de Crédito - Prof." para identificar faturas de cartão. Em vez disso, mantêm sua categoria original (SUPERMERCADO, APLICATIVOS, etc.) e usam o campo `center_cost` para indicar a qual cartão pertencem:

- `center_cost = "Cartão de Crédito - Pessoal"` → BRA Pessoal
- `center_cost = "Cartão de Crédito - Prof."` → Nu Infotkt (a confirmar valor exato)

### Alterações

**1. `src/lib/cardInvoiceRules.ts`**

Trocar critério de filtro de categoria para `center_cost`:

```text
CARD_INVOICE_CENTER_COSTS = [
  "Cartão de Crédito - Pessoal",
  "Cartão de Crédito - Prof.",
]

CENTER_COST_CARD_MAP = {
  "Cartão de Crédito - Pessoal": "BRA Pessoal",
  "Cartão de Crédito - Prof.": "Nu Infotkt",
}
```

**2. `src/hooks/useCardInvoiceTransactions.ts`**

- Alterar query para incluir `center_cost` no select
- Filtrar por `center_cost` em vez de `categories.name`
- Mapear usando `CENTER_COST_CARD_MAP` em vez de `CARD_MAP`

**3. `src/pages/Lancamentos.tsx`**

- Atualizar a identificação de "fatura de cartão" para usar `center_cost` (se houver badge ou filtro baseado em categoria)

### Verificação necessária

Antes de implementar, preciso confirmar o valor exato de `center_cost` para o cartão profissional. Dos dados vistos, só apareceu "Cartão de Crédito - Pessoal". Preciso buscar se há transações com center_cost referente ao cartão profissional.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/lib/cardInvoiceRules.ts` | Novo mapeamento por `center_cost` |
| `src/hooks/useCardInvoiceTransactions.ts` | Filtrar por `center_cost` em vez de categoria |
| `src/pages/Lancamentos.tsx` | Ajustar identificação de fatura (se aplicável) |

Sem alteração no banco. Sem novas tabelas.

