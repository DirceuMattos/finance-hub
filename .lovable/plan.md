

## Plano: Adicionar campo "Favorecido/Cliente" aos lançamentos

### O que muda
Um novo campo de texto livre chamado **Favorecido/Cliente** será adicionado às três tabelas de lançamentos — transações comuns, compras de cartão e recorrências — e aos respectivos formulários e listagens.

### Alterações técnicas

**1. Migração SQL — adicionar coluna `payee` nas 3 tabelas do banco externo**

O usuário precisará executar no SQL Editor do Supabase externo:

```sql
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payee TEXT;
ALTER TABLE public.card_purchases ADD COLUMN IF NOT EXISTS payee TEXT;
ALTER TABLE public.recurrences ADD COLUMN IF NOT EXISTS payee TEXT;
```

**2. Tipos — `src/types/database.ts`**
- Adicionar `payee: string | null` em `Transaction`, `CardPurchase`

**3. Hook de recorrências — `src/hooks/useRecurrences.ts`**
- Adicionar `payee: string | null` na interface `Recurrence`

**4. Formulário de Transações — `src/components/lancamentos/TransactionForm.tsx`**
- Adicionar campo `payee` ao schema zod (texto, opcional, max 200)
- Adicionar input de texto "Favorecido/Cliente" no formulário (logo após Descrição)
- Incluir no reset e no payload de submissão

**5. Formulário de Compras de Cartão — `src/components/cartoes/CardPurchaseForm.tsx`**
- Mesmo padrão: campo `payee` no schema, input no form, reset e payload

**6. Formulário de Recorrências — `src/components/recorrencias/RecurrenceForm.tsx`**
- Mesmo padrão: campo `payee` no schema, input no form, reset e payload

**7. Listagens — `src/pages/Lancamentos.tsx`, `src/pages/ComprasCartao.tsx`, `src/pages/Recorrencias.tsx`**
- Adicionar coluna "Favorecido" na DataTable de cada página

**8. Hook de Transações — `src/hooks/useTransactions.ts`**
- Garantir que `payee` seja incluído no select (já vem automaticamente com `*`)

