## Objetivo
Corrigir definitivamente a lógica de parcelamento para diferenciar "valor total" de "valor da parcela" via flag `is_total_amount`.

## Arquivos alterados

### 1. `src/components/lancamentos/TransactionForm.tsx`
- Adicionar `is_total_amount: z.boolean().optional().default(false)` ao schema zod.
- Adicionar `is_total_amount: false` aos `defaultValues`.
- Substituir o bloco atual no `handleSubmit` que trata `valueType` pela nova lógica:
  - Calcular `hasCard`, `installmentsCount`, `rawAmount`.
  - Se `hasCard && valueType === "total" && installmentsCount > 1`: `data.amount = String(rawAmount); data.is_total_amount = true;`
  - Caso contrário: `data.amount = String(rawAmount); data.is_total_amount = false;`

### 2. `src/hooks/useTransactions.ts`
Na `mutationFn` de `create`:
- Extrair `is_total_amount` junto com os demais campos descartados (não enviar para o insert).
- Computar:
  ```ts
  const isTotal = (item as any).is_total_amount === true;
  const baseAmount = isTotal ? (parseFloat(String(rest.amount)) / N) : parseFloat(String(rest.amount));
  ```
- Substituir a lógica atual baseada em centavos pela lógica baseada em `baseAmount`:
  ```ts
  const originalTotal = isTotal ? parseFloat(String(rest.amount)) : baseAmount * N;
  const totalFromBase = parseFloat((baseAmount * N).toFixed(2));
  const diff = parseFloat((originalTotal - totalFromBase).toFixed(2));
  ```
- Gerar `rows` usando `parcelAmount = isLast ? baseAmount + diff : baseAmount` (com `toFixed(2)`), preservando o restante da geração (descrição numerada, datas via `addMonthsKeepDay`, status `planned`, `payment_date: null`).
- Garantir que `is_total_amount` não seja enviado ao Supabase.

## Regras
- Nenhum outro arquivo será alterado.
- Comportamento para N=1 permanece igual (insert único, sem divisão).