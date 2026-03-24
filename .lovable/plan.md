

## Plano: Corrigir Faturas Projetadas usando transactions com center_cost

### Problema

A tela `FaturasProjetadas` tenta usar `vw_card_billing_projection` (view vazia) e `useBillingProjection` (card_installments, sem dados). Os dados reais de fatura estão na tabela `transactions` com `center_cost` igual a "Cartão de Crédito - Pessoal" / "Cartões de Crédito - Prof." etc. — exatamente o que `useCardInvoiceProjections()` já busca e agrupa.

### Solução

Substituir as duas fontes de dados por `useCardInvoiceProjections()` do hook existente, filtrando apenas meses futuros (>= mês atual).

### Alterações

**`src/pages/FaturasProjetadas.tsx`**

- Remover query `vw_card_billing_projection` e `useBillingProjection`
- Importar `useCardInvoiceProjections` de `@/hooks/useCardInvoiceTransactions`
- Usar `projections` como fonte, filtrando `billing_month >= YYYY-MM` (mês atual)
- Mapear para `BillingRow`: `paid_amount` = total quando status "paid", `planned_amount` = total quando status "planned"
- Filtro de cartão passa a comparar por `card_name` direto (sem lookup por id)
- Remover referência à view no rodapé

| Arquivo | O que muda |
|---|---|
| `src/pages/FaturasProjetadas.tsx` | Usar `useCardInvoiceProjections` em vez de view vazia |

Zero alteração no banco. Usa dados já existentes via `center_cost`.

