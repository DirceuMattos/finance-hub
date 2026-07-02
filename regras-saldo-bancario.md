# Regra Oficial de Saldo Bancário — Finance Hub

**Sistema:** Finance Hub  
**Backend oficial:** Supabase  
**Frontend:** Lovable  
**Data-base oficial dos saldos:** 31/03/2026  
**Status da regra:** validada e conciliada

---

## 1. Objetivo

Este documento registra a regra oficial de cálculo, atualização e auditoria dos saldos bancários do Finance Hub.

A finalidade é evitar divergências futuras entre o saldo exibido no sistema, os lançamentos financeiros e os saldos reais das contas.

O Supabase é a fonte oficial da verdade para os saldos bancários. O frontend não deve recalcular nem sobrescrever saldos manualmente.

---

## 2. Regra principal

Cada conta bancária possui um saldo de abertura em uma data-base.

No ambiente atual, a data-base oficial é:

```text
31/03/2026
```

A regra oficial é:

```text
Saldo atual = saldo de abertura + lançamentos realizados após a data-base
```

No banco de dados:

```text
accounts.current_balance = accounts.opening_balance + movimentos paid após accounts.opening_balance_date
```

---

## 3. Campos principais

Tabela principal:

```text
accounts
```

Campos utilizados:

| Campo | Descrição |
|---|---|
| `opening_balance` | Saldo real da conta na data-base |
| `opening_balance_date` | Data-base do saldo inicial |
| `current_balance` | Saldo atual da conta, atualizado pelo backend |

No ambiente validado, todas as contas usam:

```text
opening_balance_date = 2026-03-31
```

---

## 4. Quais lançamentos impactam saldo

Somente lançamentos da tabela:

```text
transactions
```

com:

```text
status = paid
```

impactam o saldo bancário.

Lançamentos com status `planned`, `cancelled` ou qualquer outro status diferente de `paid` não devem afetar o saldo bancário.

---

## 5. Data efetiva do impacto financeiro

A data efetiva usada para saber se um lançamento impacta ou não o saldo é:

```sql
coalesce(payment_date, competence_date, due_date)
```

A ordem de prioridade é:

1. `payment_date`, quando existir;
2. `competence_date`, quando não houver `payment_date`;
3. `due_date`, quando as anteriores não existirem.

Um lançamento só impacta o saldo se a data efetiva for maior que `opening_balance_date`.

Exemplo:

```text
Se opening_balance_date = 2026-03-31,
apenas lançamentos paid com data efetiva após 31/03/2026 impactam current_balance.
```

---

## 6. Impacto por tipo de lançamento

| `transaction_type` | Impacto no saldo |
|---|---:|
| `income` | Soma ao saldo |
| `expense` | Subtrai do saldo |

Exemplo:

```text
income  de R$ 1.000,00 => +1.000,00 no saldo
expense de R$ 1.000,00 => -1.000,00 no saldo
```

---

## 7. Cartões de crédito

Compras, parcelas e faturas projetadas de cartão de crédito não devem impactar diretamente o saldo bancário.

A compra no cartão representa uma obrigação futura, não uma saída imediata de conta bancária.

O saldo bancário só deve mudar quando existir um lançamento explícito na tabela `transactions` representando o pagamento da fatura ou outro pagamento efetivo.

Regra:

```text
Compra no cartão ≠ saída bancária imediata
Pagamento da fatura = saída bancária
```

O trigger de parcelas de cartão deve permanecer desativado:

```text
trg_apply_card_balance = disabled
```

---

## 8. Responsabilidade do backend

O Supabase é responsável por atualizar `accounts.current_balance` quando houver alterações em `transactions`.

A rotina de saldo deve considerar os seguintes eventos:

- criação de lançamento já realizado (`paid`);
- alteração de lançamento de `planned` para `paid`;
- alteração de lançamento de `paid` para `planned` ou `cancelled`;
- edição de valor de lançamento já realizado;
- edição da conta vinculada ao lançamento;
- edição do tipo do lançamento (`income` / `expense`);
- edição da data efetiva do lançamento;
- exclusão de lançamento realizado.

A rotina deve sempre respeitar:

```text
coalesce(payment_date, competence_date, due_date) > opening_balance_date
```

---

## 9. Responsabilidade do frontend / Lovable

O frontend não deve calcular saldo bancário localmente.

O Lovable deve:

- exibir `accounts.current_balance` como saldo atual da conta;
- tratar `current_balance` como valor calculado/atualizado pelo backend;
- não sobrescrever `current_balance` manualmente;
- permitir criar, editar, baixar, cancelar ou excluir lançamentos em `transactions`;
- recarregar contas, dashboard e fluxo financeiro após alterações em lançamentos;
- deixar claro que lançamentos futuros marcados como `paid` com `payment_date` anterior à competência impactam o saldo na data do pagamento.

O Lovable não deve:

- recalcular saldo no frontend;
- atualizar diretamente `accounts.current_balance` em telas comuns;
- fazer compras de cartão ou parcelas de cartão alterarem saldo bancário diretamente.

---

## 10. Cuidados operacionais

### 10.1. Data de pagamento anterior à competência

Um lançamento com competência futura pode impactar o saldo atual se estiver com `status = paid` e `payment_date` anterior.

Exemplo:

```text
Competência: 07/2026
Payment date: 15/06/2026
Status: paid
```

Neste caso, o lançamento impacta o saldo de junho, pois a data efetiva é `payment_date`.

Isso pode ser correto em caso de pagamento antecipado, mas precisa ser intencional.

### 10.2. Ajustes de conciliação

Ajustes manuais de saldo devem ser registrados como lançamentos em `transactions`, preferencialmente com descrição clara, por exemplo:

```text
Ajuste de Conciliação Bancária
```

Evitar alterar `current_balance` diretamente.

### 10.3. Transferências entre contas

Transferências entre contas devem ser tratadas com cuidado para não gerar distorção gerencial.

Quando uma transferência for registrada como saída em uma conta e entrada em outra, os dois lançamentos devem estar coerentes em:

- data;
- valor;
- entidade financeira;
- conta de origem;
- conta de destino;
- status.

---

## 11. Auditoria de saldo

A validação oficial deve verificar se a diferença entre o saldo salvo e o saldo calculado é zero.

A fórmula de auditoria é:

```text
calculated_balance = opening_balance + movimentos paid após opening_balance_date
```

```text
difference = current_balance - calculated_balance
```

A situação esperada é:

```text
difference = 0.00
```

---

## 12. Query oficial de auditoria

```sql
select
  a.name as account_name,
  a.opening_balance,
  a.opening_balance_date,
  a.current_balance,

  coalesce(sum(
    case
      when t.status = 'paid'
       and coalesce(t.payment_date, t.competence_date, t.due_date) > a.opening_balance_date
       and t.transaction_type = 'income'
      then t.amount

      when t.status = 'paid'
       and coalesce(t.payment_date, t.competence_date, t.due_date) > a.opening_balance_date
       and t.transaction_type = 'expense'
      then -t.amount

      else 0
    end
  ), 0) as movements_after_opening_date,

  a.opening_balance
  + coalesce(sum(
    case
      when t.status = 'paid'
       and coalesce(t.payment_date, t.competence_date, t.due_date) > a.opening_balance_date
       and t.transaction_type = 'income'
      then t.amount

      when t.status = 'paid'
       and coalesce(t.payment_date, t.competence_date, t.due_date) > a.opening_balance_date
       and t.transaction_type = 'expense'
      then -t.amount

      else 0
    end
  ), 0) as calculated_balance,

  a.current_balance
  - (
    a.opening_balance
    + coalesce(sum(
      case
        when t.status = 'paid'
         and coalesce(t.payment_date, t.competence_date, t.due_date) > a.opening_balance_date
         and t.transaction_type = 'income'
        then t.amount

        when t.status = 'paid'
         and coalesce(t.payment_date, t.competence_date, t.due_date) > a.opening_balance_date
         and t.transaction_type = 'expense'
        then -t.amount

        else 0
      end
    ), 0)
  ) as difference

from public.accounts a
left join public.transactions t
  on t.account_id = a.id
group by
  a.id,
  a.name,
  a.opening_balance,
  a.opening_balance_date,
  a.current_balance
order by a.name;
```

---

## 13. Estado validado após conciliação

Após a conciliação, todas as contas apresentaram diferença zero entre o saldo salvo e o saldo calculado.

Contas validadas:

| Conta | Situação |
|---|---|
| Aposenta - PF | OK |
| BRA - PF | OK |
| BRA Poup | OK |
| CEF - PF | OK |
| CEF - PJ | OK |
| Itaú - PF | OK |
| Itaú - PJ | OK |
| Nu-Bank - PF | OK |
| Nu-Bank - PJ | OK |
| Sicoob - PJ | OK |
| XP - Digital | OK |

---

## 14. Regra resumida

```text
Saldo atual da conta = saldo de abertura na data-base + lançamentos realizados após a data-base.
```

```text
Cartão de crédito não altera saldo bancário diretamente.
```

```text
Frontend não calcula saldo. Supabase mantém o saldo oficial.
```

---

## 15. Commit sugerido

```text
docs: documenta regra oficial de saldo bancário
```
