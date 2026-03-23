

## Plano: Exibir lançamentos de fatura de cartão nos módulos de Cartões e Faturas Projetadas

### Contexto

Os lançamentos de fatura de cartão existem na tabela `transactions` com categorias:
- "Cartões de Crédito - Pessoal" → cartão "BRA Pessoal"
- "Cartões de Crédito - Prof." → cartão "Nu Infotkt"

As telas Cartões e Faturas Projetadas só leem `card_purchases`/`card_installments` (vazias). Precisam consumir também os dados de `transactions`.

### Alterações

**1. Novo hook: `src/hooks/useCardInvoiceTransactions.ts`**

Query em `transactions` filtrando por categorias de fatura de cartão (`CARD_INVOICE_CATEGORIES`). Retorna os lançamentos agrupados por cartão e por mês, usando o mapeamento `CARD_MAP` para associar categoria → nome do cartão.

Expõe:
- `useCardInvoicesByCard(cardName)` — total de faturas por cartão (para uso na barra de progresso)
- `useCardInvoiceProjections()` — agrupamento mês/cartão para Faturas Projetadas

**2. Tela Cartões (`src/pages/Cartoes.tsx`)**

- Importar o novo hook para obter totais de fatura por cartão
- Calcular uso do limite: somar `amount` das transações de fatura vinculadas ao cartão pelo mapeamento `CARD_MAP`
- Atualizar as barras de progresso com valores reais em vez de zero fixo
- Manter a nota informativa existente

**3. Tela Faturas Projetadas (`src/pages/FaturasProjetadas.tsx`)**

- Combinar dados de `useBillingProjection()` (card_installments) com dados de `useCardInvoiceProjections()` (transactions de fatura)
- Exibir as faturas de cartão agrupadas por mês e cartão
- Mostrar status (Previsto/Realizado) baseado no `status` real da transaction
- Adicionar coluna de status na tabela

**4. `src/lib/cardInvoiceRules.ts`**

- Adicionar mapeamento reverso: nome do cartão → categoria (para facilitar lookups)

### Lógica de agrupamento para Faturas Projetadas

```text
transactions (category = "Cartões de Crédito - Pessoal")
  → card_name = "BRA Pessoal"
  → billing_month = competence_date (yyyy-MM)
  → due_date = due_date da transaction
  → total_amount = amount
  → status = transaction.status
```

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/hooks/useCardInvoiceTransactions.ts` | Novo — query de transactions de fatura agrupadas |
| `src/pages/Cartoes.tsx` | Barras de progresso com dados reais de fatura |
| `src/pages/FaturasProjetadas.tsx` | Combinar projeções com transactions de fatura |
| `src/lib/cardInvoiceRules.ts` | Mapeamento reverso cartão → categoria |

Sem alteração no banco. Sem novas tabelas.
