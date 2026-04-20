

## Plano: Estancar o bug + diagnóstico + recuperação

### Passo 1 — Corrigir parser (estanca o sangramento)

**Arquivo:** `src/components/lancamentos/TransactionForm.tsx`

Substituir o parser ingênuo por `parseAmountInput` robusto que detecta corretamente formato pt-BR (`1.234,56`), JS (`466.66`), en-US (`1,234.56`) e inteiros — sem nunca remover ponto decimal solitário. Detalhes técnicos no plano anterior já aprovado.

### Passo 2 — Query SQL de diagnóstico (read-only)

Entregar SQL para você rodar no SQL Editor do Supabase externo:

```sql
-- Lançamentos com valores suspeitos de corrupção 100x
SELECT id, description, amount, transaction_type, status,
       competence_date, due_date, updated_at, created_at
FROM transactions
WHERE amount >= 10000
  AND amount = ROUND(amount)            -- valor "redondo" sem centavos
  AND updated_at > created_at + interval '1 minute'  -- foi editado depois de criado
ORDER BY updated_at DESC
LIMIT 200;
```

Critério conservador: valor ≥ R$ 10.000, sem centavos, e que foi editado pós-criação. Você revisa visualmente cada um.

### Passo 3 — Correção manual pela UI (após Passo 1 estar no ar)

Para cada linha suspeita identificada no Passo 2, abrir em Lançamentos, ajustar o valor correto e salvar. Como o parser estará corrigido, salvar não corromperá novamente.

### Passo 4 — Recalcular saldos

Após corrigir os lançamentos: **Configurações → Contas → Recalcular Saldos**. A função `recalculate_account_balances` reprocessa todos os saldos a partir de `transactions.status='paid'` + `card_installments.status='paid'`.

### Passo 5 — Validar Dashboard

Recarregar Dashboard. Cards de Receita/Despesa Paga, Saldo das Contas, Saldo Projetado e Top Categorias devem refletir os valores corretos. Cache do React Query é invalidado automaticamente nas mutações.

### Arquivos alterados nesta etapa

- `src/components/lancamentos/TransactionForm.tsx` — único arquivo de código.
- Nenhuma migração de banco. Nenhum UPDATE em massa.

### Riscos

| Risco | Mitigação |
|---|---|
| Lançamentos corrompidos com valor < R$ 10.000 escaparem do diagnóstico | Posso entregar uma 2ª query mais ampla (ex.: amount entre 1.000 e 10.000 sem centavos) se você quiser revisar mais |
| Saldo continuar errado mesmo após recalcular | Significa que há `card_installments` corrompidas — escopo separado, posso investigar depois |
| Você corrigir um valor que na verdade estava certo | Mitigado por revisão manual item a item, sem automação |

