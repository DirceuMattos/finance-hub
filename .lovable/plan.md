
Objetivo: separar semanticamente cartão de `center_cost` no formulário de Lançamentos e padronizar toda a competência de cartão por `billing_month`, para que formulário, listagem e Dashboard passem a falar a mesma língua.

### 1. Corrigir a modelagem do cartão no `TransactionForm`
Hoje o formulário usa `center_cost` como se fosse o cartão selecionado, o que está semanticamente incorreto.

#### Ajustes em `src/components/lancamentos/TransactionForm.tsx`
- parar de derivar `hasCardSelected` a partir de `center_cost`
- verificar o campo disponível para cartão:
  - `payment_method` existe no tipo `Transaction`, mas representa método de pagamento, não identificação do cartão
  - não há evidência de um `card_id` específico na transação atual
- portanto, criar um campo opcional `card_id` no schema do formulário e no estado do formulário
- substituir:
  - `watchCenterCost`
  - `hasCardSelected`
  - `cardSelected`
  
  para usarem `card_id`

#### Ajustes de UI
- trocar o select hoje ligado a `center_cost` por um select ligado a `card_id`
- continuar exibindo a lista vinda de `useCards()`, mas usando:
  - `value = card.id`
  - label = `card.name`
- manter a mensagem de bloqueio de parcelamento no cartão, mas baseada em `card_id`

### 2. Preservar `center_cost` como centro de custo
`center_cost` não deve mais ser usado para escolher cartão.

#### Regra nova
- `center_cost` volta a ter semântica exclusiva de centro de custo
- se ele ainda precisar continuar existindo por compatibilidade com relatórios legados, ele não participa mais da lógica de “cartão selecionado” no formulário

#### Impacto esperado
- escolher um cartão deixa de depender do nome textual salvo em `center_cost`
- a validação “para parcelar no cartão, use Compras no Cartão” passa a ser tecnicamente correta

### 3. Persistência do `card_id`
Como o tipo atual de transação não expõe `card_id`, a implementação precisa alinhar frontend e backend.

#### Se a coluna `transactions.card_id` já existir no backend
- incluir `card_id` no tipo `Transaction`
- incluir `card_id` no payload de create/update em `src/hooks/useTransactions.ts`
- incluir `card_id` no `select(...)` da query de transações
- incluir `card_id` na lista de `editableFields`

#### Se a coluna `transactions.card_id` não existir
- criar coluna opcional `card_id uuid null` em `transactions`
- relacionar com `cards.id`
- manter nullable para compatibilidade com lançamentos antigos e não-cartão
- depois ajustar o frontend para enviar/ler esse campo

Isso permite identificar cartão de forma estruturada, sem depender de texto livre.

### 4. Ajustar fluxo de edição e promoção de parcelas em `Lancamentos`
Há pontos na tela de Lançamentos que ainda montam rascunhos usando `center_cost` como cartão.

#### Ajustes em `src/pages/Lancamentos.tsx`
- ao abrir edição de uma linha comum, carregar `card_id` se existir
- ao promover uma parcela/cartão para edição, preencher:
  - `card_id` com o cartão real
  - não mais `center_cost: r.card_name`
- revisar o mapeamento de linhas unificadas para que:
  - `card_name` continue sendo exibido
  - `card_id` seja preservado quando necessário para edição

### 5. Ajustar o tipo da transação
Em `src/types/database.ts`:
- adicionar `card_id?: string | null` ao tipo `Transaction`

Se houver dependências que clonam transações parciais:
- revisar `PaymentDialog` e demais payloads de cópia/saldo remanescente para preservar `card_id` quando fizer sentido

### 6. Padronizar filtro de parcelas por `billing_month`
Hoje há inconsistência:
- `useCardInstallments` filtra por `due_date`
- `useDashboardData` filtra por `billing_month`

Isso precisa ser unificado em `billing_month`, que é a competência financeira correta do cartão.

#### Ajustes em `src/hooks/useCardInstallments.ts`
- trocar o filtro mensal server-side:
  - de `due_date`
  - para `billing_month`
- atualizar o comentário para refletir isso
- manter a ordenação visual como fizer mais sentido para a tela:
  - pode continuar por `due_date` para exibição
  - mas o recorte do mês deve ser por `billing_month`

### 7. Validar consistência do Dashboard e de módulos relacionados
Em `src/hooks/useDashboardData.ts`, o Dashboard já usa `billing_month`. A ideia é manter isso e alinhar o restante.

Também revisar pontos que consomem parcelas e podem continuar misturando os conceitos:
- `src/hooks/useCardInvoiceTransactions.ts`
- `src/pages/Lancamentos.tsx`
- `src/pages/FaturasProjetadas.tsx`

Regra final:
- competência financeira de cartão = `billing_month`
- vencimento exibido = `due_date`

### 8. Compatibilidade com legado
Há memória de projeto indicando lógica legada baseada em `center_cost` para identificação de faturas.

Para não quebrar o que já existe:
- manter a leitura legada de `center_cost` apenas onde ela ainda for necessária para histórico/compatibilidade
- não usar mais `center_cost` como origem de verdade para seleção de cartão no formulário novo
- priorizar sempre `card_id` quando existir
- deixar mapeamentos legados apenas como fallback de leitura, não de gravação

### Arquivos previstos para alteração
- `src/components/lancamentos/TransactionForm.tsx`
- `src/hooks/useTransactions.ts`
- `src/types/database.ts`
- `src/pages/Lancamentos.tsx`
- `src/hooks/useCardInstallments.ts`
- possivelmente `src/components/lancamentos/PaymentDialog.tsx`
- possivelmente `src/hooks/useCardInvoiceTransactions.ts`
- migração backend apenas se `transactions.card_id` ainda não existir

### Resultado esperado
- `center_cost` deixa de ser usado indevidamente como cartão
- o formulário passa a identificar cartão por `card_id`
- o bloqueio de parcelamento no cartão fica semanticamente correto
- listagem de parcelas e Dashboard passam a fechar entre si, porque ambos usarão `billing_month` como referência de competência
- o sistema fica menos frágil, sem depender de nomes textuais para identificar cartão
