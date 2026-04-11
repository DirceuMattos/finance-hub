

## Plano: Corrigir criacao e edicao de compras no cartao

### Diagnostico

Identifiquei **duas causas raiz** confirmadas pela analise dos dados de rede e do codigo:

**Problema 1 -- Erro ao criar nova compra ("Campos obrigatorios")**: O formulario `CardPurchaseForm.tsx` monta o payload com `purchase_date`, `total_amount`, `installment_amount`, etc., mas **nunca calcula nem envia `first_billing_month`**. Este campo e NOT NULL na tabela `card_purchases`, entao o banco retorna erro 23502 que o `errorMessages.ts` traduz como "Campos obrigatorios nao foram preenchidos".

**Problema 2 -- Registro desaparece apos edicao**: Ao editar uma compra (ex: atualizar valor de previsao de supermercado), o `update` em `useCardPurchases.ts` atualiza o `card_purchases` mas **nao recalcula `first_billing_month`** nem atualiza `billing_month` e `due_date` das parcelas em `card_installments`. O registro editado `15a2742a` tem `first_billing_month: "2025-03-01"` (data corrupta de edicao anterior), e suas parcelas ficam com `due_date` em marco/2025, fora do filtro de abril/2026. Resultado: desaparece da tela.

### Logica de calculo automatico

Com base nos dados do cartao (`closing_day`, `due_day`):

```text
Se purchase_date.dia <= closing_day:
  first_billing_month = mesmo mes da compra
Senao:
  first_billing_month = proximo mes

due_date de cada parcela = first_billing_month + (N-1) meses, dia = due_day
billing_month de cada parcela = first_billing_month + (N-1) meses
```

### Alteracoes

**1. `src/components/cartoes/CardPurchaseForm.tsx` -- Calcular `first_billing_month` automaticamente**

No `handleSubmit`, apos montar o payload, buscar o `closing_day` e `due_day` do cartao selecionado (ja disponivel via prop `cards`), e calcular:
- `first_billing_month` com base em `purchase_date` e `closing_day`
- Incluir no payload enviado ao `onSubmit`

**2. `src/hooks/useCardPurchases.ts` -- Recalcular parcelas na edicao**

Na mutacao `update`, apos atualizar `card_purchases`:
- Buscar o cartao correspondente para obter `closing_day` e `due_day`
- Recalcular `first_billing_month` se `purchase_date` foi alterado
- Atualizar `billing_month` e `due_date` de cada parcela em `card_installments` (nao apenas `amount`)
- Na mutacao `create`, garantir que `first_billing_month` esta presente no payload

**3. `src/hooks/useRepairInstallments.ts` -- Expandir reparo para corrigir datas**

Alem de corrigir `amount`, o reparo tambem deve recalcular `billing_month` e `due_date` das parcelas com base em `first_billing_month`, `due_day` do cartao e `installment_number`. Isso corrige registros legados corrompidos.

**4. `src/hooks/useCardPurchases.ts` -- Na mutacao create, incluir `first_billing_month`**

Garantir que o `first_billing_month` calculado no formulario seja passado para o insert. Tambem filtrar campos de join (`cards`, `categories`, `financial_entities`) do payload antes de enviar.

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/cartoes/CardPurchaseForm.tsx` | Calcular `first_billing_month` no `handleSubmit` usando `closing_day` do cartao |
| `src/hooks/useCardPurchases.ts` | Na `update`, recalcular `first_billing_month` + atualizar `billing_month`/`due_date` das parcelas. Na `create`, garantir payload completo |
| `src/hooks/useRepairInstallments.ts` | Expandir para corrigir `billing_month` e `due_date` das parcelas alem de `amount` |

### Sem alteracoes no banco de dados

