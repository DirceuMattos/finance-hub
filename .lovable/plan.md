

## Plano: Corrigir marcação de cartão de crédito em Lançamentos

### Problema real

1. **`source_type: "card"` não pode ser gravado** — o banco tem uma constraint (`transactions_source_type_check`) que não aceita o valor `"card"`
2. **A detecção de cartão já funciona** via campo `center_cost` — é assim que o badge "Fatura" aparece em Lançamentos e que o módulo de Cartões agrega dados
3. **O formulário tenta gravar `source_type: "card"`**, que falha com erro, e o lançamento não é salvo

### Solução

Substituir o checkbox `is_card_movement` por um **select de `center_cost`** que permite ao usuário indicar a qual cartão o lançamento pertence. Esse é o campo que já alimenta o módulo de Cartões — usar ele diretamente resolve os dois problemas: marca o lançamento como cartão E faz aparecer no módulo de Cartões.

### Alterações

**1. `src/components/lancamentos/TransactionForm.tsx`**

- **Remover** campo `is_card_movement` (boolean) e `source_type` do submit
- **Adicionar** campo select "Cartão de Crédito" com opções:
  - Nenhum (valor vazio → `center_cost: null`)
  - BRA Pessoal → `center_cost: "Cartões de Crédito - Pessoal"`
  - Nu Infotkt → `center_cost: "Cartões de Crédito - Prof."`
- Adicionar `center_cost` ao schema Zod (string opcional, nullable)
- No `useEffect` de edição, preencher o select com base em `transaction.center_cost`
- No `handleSubmit`, gravar `center_cost` com o valor selecionado

**2. `src/pages/Lancamentos.tsx`**

- **Remover** `source_type === "card"` da detecção de cartão (nunca funcionou por causa da constraint)
- Manter detecção via `center_cost` e categoria (que já funciona)
- Badge "Fatura" continua aparecendo como antes

**3. `src/hooks/useTransactions.ts`**

- Sem alteração — o `select("*", ...)` já traz `center_cost`

### Resultado

- Ao criar/editar lançamento, o usuário seleciona o cartão associado
- O `center_cost` é gravado no banco (campo já existente, sem constraint bloqueante)
- O módulo de Cartões (`useCardInvoiceTransactions`) já detecta lançamentos por `center_cost` → dados aparecem automaticamente
- Badge "Fatura" no Lançamentos continua funcionando via `center_cost`

| Arquivo | O que muda |
|---|---|
| `src/components/lancamentos/TransactionForm.tsx` | Trocar checkbox por select de cartão usando `center_cost` |
| `src/pages/Lancamentos.tsx` | Remover referência a `source_type === "card"` |

Zero alteração no banco. Usa campo existente que já alimenta o módulo de Cartões.

