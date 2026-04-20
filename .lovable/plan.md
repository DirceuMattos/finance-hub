

## Plano: Edição de cartão legado, fim da auto-marcação como pago e listagem dos lançamentos inconsistentes

### 1) Ajustes no banco de dados

Não é necessário alterar **schema**. Mas precisaremos rodar uma **limpeza de dados** (UPDATE) para corrigir os registros que estão com `status='paid'` indevidamente. Como sua base fica em projeto Supabase externo, eu não posso executar — vou te entregar o SQL pronto para você rodar no SQL Editor do projeto externo, junto com queries de listagem para auditoria prévia.

### 2) Permitir edição completa dos lançamentos de cartão (legado)

Hoje, na tabela de Lançamentos, linhas vindas de `card_installments` (badge "Cartão (legado)") só mostram os botões de baixa/reverter — não há Editar nem Excluir. Vou ajustar `src/pages/Lancamentos.tsx` para que essas linhas tenham as mesmas ações dos lançamentos comuns:

- **Editar**: abre o `TransactionForm` em modo "promoção", carregando os dados da parcela (descrição, valor, vencimento, cartão, parcela X/Y, categoria, entidade) e, ao salvar, cria um `transaction` equivalente em `transactions` (com `center_cost` = nome do cartão e `installment_number/total` preenchidos) e marca a parcela original como `cancelled` para não duplicar. Assim a parcela legada migra para o modelo unificado e passa a ser totalmente editável daí em diante.
- **Baixa/Reverter/Cancelar**: continuam disponíveis na linha legada enquanto não for migrada.
- **Excluir**: remove a parcela legada (`card_installments`) com confirmação.

Arquivo afetado: `src/pages/Lancamentos.tsx` (coluna de ações + handler de promoção). Reaproveita `TransactionForm` e `useTransactions().create` + `useCardInstallmentStatusUpdate` (cancelar a parcela origem).

### 3) Causa raiz dos lançamentos com "Realizado" indevido + correção em código

**Causa raiz identificada:** `src/components/lancamentos/CsvImportDialog.tsx`, linhas 218–219:

```ts
const status = dueDate && dueDate <= today ? "paid" : "planned";
const paymentDate = status === "paid" ? dueDate : null;
```

Toda importação de CSV marca como **Realizado** + preenche `payment_date` automaticamente sempre que o vencimento é passado. Isso fere a regra "o sistema nunca preenche data/status de pagamento automaticamente".

**Correção:** importar tudo como `status='planned'` e `payment_date=null`, deixando a baixa para ato manual do usuário.

Arquivo afetado: `src/components/lancamentos/CsvImportDialog.tsx`.

### 4) Listagem dos registros inconsistentes (para você revisar)

Como não tenho acesso ao banco externo, vou te entregar dois SELECTs prontos. A regra de inconsistência considerada:

- Status `paid`, mas `payment_date` é nulo, **OU** `payment_date > 2026-04-20`, **OU** `due_date > 2026-04-20` (vencimento futuro marcado como pago).

```sql
-- (A) Lançamentos comuns inconsistentes
SELECT id, description, transaction_type, amount, competence_date, due_date,
       payment_date, center_cost, installment_number, installment_total
FROM transactions
WHERE status = 'paid'
  AND (payment_date IS NULL
       OR payment_date > DATE '2026-04-20'
       OR due_date    > DATE '2026-04-20')
ORDER BY due_date DESC NULLS LAST;

-- (B) Parcelas de cartão (legado) inconsistentes
SELECT ci.id, cp.description, c.name AS cartao, ci.installment_number,
       ci.billing_month, ci.due_date, ci.amount, ci.status
FROM card_installments ci
JOIN card_purchases cp ON cp.id = ci.card_purchase_id
JOIN cards          c  ON c.id  = cp.card_id
WHERE ci.status = 'paid'
  AND ci.due_date > DATE '2026-04-20'
ORDER BY ci.due_date DESC;
```

### 5) Limpeza de dados (rodar após sua revisão)

Sugestão conservadora: **reverter** para previsto somente o que é claramente futuro/sem comprovação:

```sql
-- (A) Transactions
UPDATE transactions
   SET status = 'planned',
       payment_date = NULL,
       updated_at = now()
 WHERE status = 'paid'
   AND (payment_date IS NULL
        OR payment_date > DATE '2026-04-20'
        OR due_date    > DATE '2026-04-20');

-- (B) Card installments
UPDATE card_installments
   SET status = 'projected',
       updated_at = now()
 WHERE status = 'paid'
   AND due_date > DATE '2026-04-20';
```

Você decide se quer aplicar em massa ou caso a caso após ver a listagem do passo 4.

### Resumo das alterações

| Arquivo | Mudança |
|---|---|
| `src/components/lancamentos/CsvImportDialog.tsx` | Importar sempre como `planned` e `payment_date=null` (eliminar auto-marcação) |
| `src/pages/Lancamentos.tsx` | Adicionar ações Editar/Excluir nas linhas legadas; ao editar, promover a parcela para `transactions` e cancelar a origem |
| Banco (manual) | Rodar SELECTs de auditoria e UPDATEs de correção no Supabase externo |

### Riscos

| Risco | Mitigação |
|---|---|
| Promoção de parcela legada gerar duplicidade em Faturas Projetadas | Cancelar a parcela origem na mesma operação e confiar na deduplicação por id já existente |
| Importações antigas que dependiam do auto-paid | Usuário passa a dar baixa em lote (já existe fluxo de baixa); comportamento alinhado à regra de negócio |
| UPDATE em massa reverter pagamentos legítimos | Listar antes (passo 4) e permitir rodar caso a caso |

