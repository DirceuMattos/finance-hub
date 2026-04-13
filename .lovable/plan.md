

## Plano: Limpar data de pagamento em lançamentos previstos

### Problema

Ao editar um lançamento com status "planned" (previsto), o formulário permite que `payment_date` seja enviado ao banco. Isso ocorre porque o `handleSubmit` não valida a regra de negócio: lançamentos previstos não devem ter data de pagamento.

### Alteração

**`src/components/lancamentos/TransactionForm.tsx`** — No `handleSubmit`, forçar `payment_date: null` quando `status === "planned"` ou `status === "projected"`:

```typescript
payment_date: (data.status === "paid") && data.payment_date
  ? format(data.payment_date, "yyyy-MM-dd")
  : null,
```

Isso garante que apenas lançamentos com status "paid" (realizado) persistam a data de pagamento. Para os demais status (`planned`, `cancelled`, `projected`), o campo será sempre `null` independentemente do que estiver no formulário.

### Arquivo modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/lancamentos/TransactionForm.tsx` | Forçar `payment_date = null` quando status não for `paid` |

