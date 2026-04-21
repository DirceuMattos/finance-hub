
## Correção do cálculo de comprometimento de cartões no Dashboard

Ajustes pontuais em `src/hooks/useDashboardData.ts` para eliminar dupla contagem de cartões e consolidar o `projected_card_amount` a partir de duas fontes (`card_installments` + `transactions` com `center_cost` de cartão).

### Alterações em `src/hooks/useDashboardData.ts`

**1. `monthlyFlow` — remover `card_from_transactions`**
- Remover o loop que soma `card_from_transactions` a partir de `txData`.
- Remover a linha `projected_card_amount = projected_card_amount + card_from_transactions;`.
- O `projected_card_amount` retornado por `monthlyFlow` passa a refletir apenas parcelas de `card_installments` com status diferente de `paid`.

**2. `cardMonthTotal` — filtrar apenas parcelas não pagas e somar transações de fatura**
- Adicionar `.neq("status", "paid")` na query de `card_installments`.
- Após o loop de installments, fazer segunda query em `transactions` filtrando:
  - `status` diferente de `paid` e `cancelled`
  - `competence_date` no intervalo do mês
  - `center_cost` em `["Cartão de Crédito - Pessoal", "Cartão de Crédito - Prof.", "Cartões de Crédito - Pessoal", "Cartões de Crédito - Prof."]`
- Aplicar o mesmo filtro de `filterIds` (entity) no loop e somar `Math.abs(amount)` ao `total`.

**3. Import `CARD_INVOICE_CENTER_COSTS`**
- Após remover o bloco em `monthlyFlow`, o símbolo deixa de ser usado no arquivo. Remover o import de `@/lib/cardInvoiceRules`.
- A lista de center_costs usada em `cardMonthTotal` será inline (literal no `.in(...)`), conforme spec do usuário.

### Arquivos alterados
- Apenas `src/hooks/useDashboardData.ts`.

### Resultado esperado (Abril/2026)
- `card_installments` não pagas: R$ 7.413,75
- Transações com center_cost de cartão não pagas: R$ 2.029,09
- `projected_card_amount` no Dashboard: R$ 9.442,84
- Sem dupla contagem entre `expense_planned` e o card de comprometimento.
