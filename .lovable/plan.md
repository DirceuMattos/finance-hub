

## Plano: Corrigir edição de compras no cartão e erro de campos obrigatórios

### Diagnóstico

**Problema 1 — Erro de campos obrigatórios**: A função `handleEditPurchase` em `ComprasCartao.tsx` não popula `total_amount`, `category_id`, `notes` e `status` ao montar o objeto de edição. O formulário abre com `total_amount: 0`, que falha na validação (`min(0.01)`), gerando o erro "campos obrigatórios não preenchidos" sem indicar qual campo.

**Problema 2 — Registro desaparece após edição**: A mutação `update` em `useCardPurchases.ts` atualiza apenas a tabela `card_purchases`, mas **não recalcula as parcelas** na tabela `card_installments`. Quando o valor total ou a quantidade de parcelas muda, as parcelas ficam desatualizadas. Além disso, se o `installment_amount` enviado for 0 (porque `total_amount` não foi populado), as parcelas podem ficar com valor 0 e não aparecer nos filtros.

### Alterações

**1. `src/pages/ComprasCartao.tsx` — Completar dados de edição**

Na função `handleEditPurchase`, incluir todos os campos necessários:
- `total_amount` (calcular como `installment_amount × installments_count` se não disponível diretamente na query de installments)
- `category_id`
- `notes`
- `status`
- `first_billing_month`

Como a query de `card_installments` faz join com `card_purchases` mas não traz `total_amount`, será necessário **buscar a compra completa** via query direta ou ajustar o select do join para incluir `total_amount`.

**2. `src/hooks/useCardInstallments.ts` — Expandir campos no join**

Adicionar `total_amount`, `installment_amount`, `notes`, `category_id`, `status` ao select do join com `card_purchases` para que esses dados estejam disponíveis na edição.

**3. `src/hooks/useCardPurchases.ts` — Recalcular parcelas na edição**

Na mutação `update`, após atualizar `card_purchases`, recalcular o `amount` de cada parcela (`card_installments`) vinculada àquela compra com o novo `installment_amount`.

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCardInstallments.ts` | Expandir select do join para incluir `total_amount`, `installment_amount`, `notes`, `category_id`, `status` |
| `src/pages/ComprasCartao.tsx` | Completar `handleEditPurchase` com todos os campos |
| `src/hooks/useCardPurchases.ts` | Na mutação update, recalcular `amount` das parcelas vinculadas |
| `src/hooks/useCardInstallments.ts` (tipo) | Atualizar interface `InstallmentRow` com os novos campos |

### Sem alterações no banco de dados

