

## Plano: Limpar datas de pagamento incorretas e permitir limpeza manual

### Problema
1. Existem lançamentos com status diferente de "paid" que possuem `payment_date` preenchida indevidamente
2. O formulário de edição não permite limpar (remover) uma data de pagamento já preenchida — o campo DateField só permite selecionar uma nova data, não há botão para apagar
3. O sistema nunca deve preencher `payment_date` automaticamente

### Alterações

**1. `src/components/lancamentos/TransactionForm.tsx`** — Adicionar botão "Limpar" no DateField

No componente `DateField`, quando houver valor preenchido, exibir um pequeno botão (ícone ✕) ao lado para permitir que o usuário limpe a data manualmente, chamando `field.onChange(null)`.

Além disso, ao carregar um lançamento para edição (`useEffect`), forçar `payment_date: null` quando o status não for `"paid"`, garantindo que datas erradas não apareçam no formulário:

```typescript
payment_date: (transaction.status === "paid" && transaction.payment_date)
  ? parseDateFromString(transaction.payment_date)
  : null,
```

**2. Limpeza em massa via SQL** — Executar uma migração para limpar os registros existentes:

```sql
UPDATE transactions
SET payment_date = NULL, updated_at = now()
WHERE status != 'paid' AND payment_date IS NOT NULL;
```

### Resumo

| Item | Alteração |
|------|-----------|
| `TransactionForm.tsx` | Botão limpar no DateField + forçar `payment_date = null` para status != paid na carga |
| Migração SQL | Limpar `payment_date` de todos os lançamentos com status diferente de "paid" |

