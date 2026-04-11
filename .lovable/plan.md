

## Plano: Limitar reparo de parcelas ao mês atual e futuros

### Alteração

**`src/hooks/useRepairInstallments.ts`**: Adicionar filtro na query de `card_installments` para considerar apenas parcelas com `billing_month >= mês atual` (formato `YYYY-MM-01`). Parcelas antigas já pagas não serão processadas.

Na query de compras (`card_purchases`), filtrar apenas compras que possuam parcelas no período relevante, ou aplicar o filtro diretamente nas parcelas de cada compra durante o loop de correção.

### Detalhes técnicos

- Calcular `currentMonth = format(new Date(), "yyyy-MM") + "-01"`
- Na query de `card_installments` dentro do loop, adicionar `.gte("billing_month", currentMonth)`
- Alternativamente, ao buscar as compras, filtrar por `first_billing_month` ou aplicar o filtro no nível das parcelas individuais
- Parcelas com status `paid` também serão excluídas do reparo via `.neq("status", "paid")`

### Arquivo modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useRepairInstallments.ts` | Filtrar parcelas por `billing_month >= mês atual` e `status != paid` |

