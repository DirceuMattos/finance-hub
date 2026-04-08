

## Diagnóstico: Dados de cartões não aparecem em Faturas Projetadas

### Causa raiz

O módulo **Faturas Projetadas** (`FaturasProjetadas.tsx`) usa o hook `useCardInvoiceProjections`, que lê da tabela **`transactions`** filtrando por `center_cost` (ex: "Cartão de Crédito - Pessoal"). Ele **não lê** de `card_purchases` nem `card_installments`.

Os dados importados foram inseridos na tabela `card_purchases`, que é uma tabela separada. São dois fluxos de dados independentes:

| Fonte | Tabela | Módulo que consome |
|---|---|---|
| Importador de lançamentos | `transactions` | Faturas Projetadas, Lançamentos |
| Importador/cadastro de compras | `card_purchases` + `card_installments` | Compras Cartão |

### Solução proposta

Ajustar o hook `useCardInvoiceProjections` para **também incluir dados de `card_purchases`/`card_installments`**, unificando ambas as fontes na mesma visualização.

### Alterações

**1. `src/hooks/useCardInvoiceTransactions.ts`**

Na função `useCardInvoiceTransactionsQuery`, após buscar os dados de `transactions` por `center_cost`, também buscar de `card_installments` (com join em `card_purchases` e `cards`) e unificar os dois conjuntos em um único array de `CardInvoiceTransaction`.

- Buscar `card_installments` com status `pending`/`open`, fazendo join para obter `card_name` via `card_purchases.cards.name`
- Mapear cada installment para o mesmo formato `CardInvoiceTransaction`:
  - `competence_date` = `billing_month` + `-01`
  - `due_date` = `due_date` da parcela
  - `status` = mapear `pending`→`planned`, `paid`→`paid`
  - `card_name` = nome do cartão via join
  - `amount` = valor da parcela
- Concatenar com os registros vindos de `transactions`
- Deduplicar se necessário (evitar contar duas vezes o mesmo lançamento)

**2. Nenhuma alteração no banco de dados** — apenas leitura das tabelas existentes.

### Resultado esperado

O módulo Faturas Projetadas passará a exibir tanto os lançamentos manuais (via `transactions` com `center_cost`) quanto as compras de cartão importadas (via `card_purchases`/`card_installments`), unificados na mesma projeção mensal.

