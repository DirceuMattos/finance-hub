

## Plano: Corrigir status dos lançamentos futuros

### Diagnóstico

O código do frontend **já está correto** — `resolveStatus = (r) => r.status` usa exclusivamente o campo do banco. O problema está nos **dados importados**: todos os registros foram carregados com `status = 'paid'`, inclusive lançamentos de dezembro 2026.

Evidência do response da API:
```text
competence_date: "2026-12-01"
due_date: "2026-12-25"
status: "paid"          ← dado real do banco, incorreto para lançamento futuro
```

### Solução

Executar uma **correção pontual de dados** via migration (UPDATE, não altera schema):

```sql
UPDATE transactions
SET status = 'planned', updated_at = now()
WHERE due_date > CURRENT_DATE
  AND status = 'paid';
```

Isso corrige todos os lançamentos com vencimento futuro para `planned` (Previsto), mantendo os passados como `paid` (Realizado).

Nenhuma alteração no frontend — o código já está preparado para exibir:
- `paid` → Realizado (verde)
- `planned` → Previsto (amarelo)
- `cancelled` → Cancelado (vermelho)

### Resumo

| Item | Detalhe |
|---|---|
| Causa raiz | Dados importados com `status = 'paid'` para todos os registros |
| Correção | UPDATE em `transactions` onde `due_date > CURRENT_DATE` |
| Frontend | Sem alteração — já usa `r.status` corretamente |
| Schema | Sem alteração |

