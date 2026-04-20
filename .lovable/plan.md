

## Plano: Unificação de Lançamentos e Remoção do módulo Compras no Cartão

### Estratégia geral

Remover o módulo **Compras no Cartão** como interface operacional, mantendo a base de dados (`card_purchases`, `card_installments`) intacta para preservar a lógica de **Cartões** e **Faturas Projetadas**, que continuam alimentadas tanto por essas tabelas quanto pelo `center_cost` em `transactions`. Toda criação/edição/baixa/cancelamento passa a ocorrer no módulo **Lançamentos**, com lançamentos de cartão sendo lançamentos comuns enriquecidos com cartão + parcela.

### Decisão importante de compatibilidade

A visão unificada de Lançamentos hoje **mescla** registros de `transactions` + `card_installments` (parcelas de compras antigas). Para evitar duplicidade e permitir edição completa, vou:

- **Manter** a exibição de parcelas legadas (`card_installments`) na listagem como linhas read-only com badge "Cartão (legado)" e ações de baixa/reverter já existentes.
- **Novos lançamentos** de cartão: criados como `transactions` comuns, com `center_cost = nome do cartão` e `installment_number/total` preenchidos. Estes alimentam as Faturas Projetadas via Source 1 (`useCardInvoiceTransactionsQuery` já lê `center_cost`).
- Não há duplicidade porque cada parcela legada continua única na sua origem; o usuário simplesmente para de criar novos via "Compras no Cartão".

### Alterações

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/App.tsx` | Remover import de `ComprasCartao` e a rota `/compras-cartao`. |
| 2 | `src/components/layout/AppSidebar.tsx` | Remover item "Compras no Cartão" do grupo "Cartões". |
| 3 | `src/pages/ComprasCartao.tsx` | **Deletar** o arquivo. |
| 4 | `src/components/cartoes/CardPurchaseForm.tsx` | **Deletar** o arquivo (não usado fora do módulo removido). |
| 5 | `src/components/lancamentos/TransactionForm.tsx` | (a) Renomear visualmente o campo "Cartão de Crédito" para deixar claro que vincula o lançamento a um cartão (não apenas pagamento de fatura). (b) Quando `center_cost` estiver preenchido, exibir hint "Este lançamento será incluído na fatura do cartão selecionado". (c) Garantir que `installment_number/installment_total` continuem editáveis (já estão). |
| 6 | `src/pages/Lancamentos.tsx` | (a) Adicionar **filtro por cartão** (Select com cartões ativos, filtrando `center_cost === card.name` ou parcela legada com `cards.name`). (b) Adicionar **filtro Parcelado / Não parcelado** (`installment_total > 1`). (c) Coluna "Cartão" exibindo `center_cost` ou nome do cartão da parcela. (d) Estender busca global para incluir `center_cost` e número de parcela `X/Y`. (e) Renomear badge das parcelas legadas para "Cartão (legado)". |
| 7 | `src/hooks/useCardInvoiceTransactions.ts` | Nenhuma mudança — Source 1 (`transactions.center_cost`) e Source 2 (`card_installments`) continuam alimentando Faturas Projetadas. Novos lançamentos de cartão entram automaticamente via Source 1. |
| 8 | `src/lib/cardInvoiceRules.ts` | Revisar `CARD_INVOICE_CENTER_COSTS` para aceitar dinamicamente qualquer nome de cartão cadastrado (não apenas a lista hardcoded), ou ajustar `useCardInvoiceTransactionsQuery` para incluir transações cujo `center_cost` corresponda a qualquer cartão ativo (via join client-side com `useCards()`). |

### Itens fora do escopo (preservados)
- Tabelas `card_purchases` / `card_installments` no banco — mantidas.
- Hooks `useCardPurchases`, `useCardInstallments`, `useRepairInstallments` — mantidos (ainda usados por Lançamentos para exibir parcelas legadas e pelo Cartões/Faturas).
- Páginas `Cartoes.tsx` e `FaturasProjetadas.tsx` — sem alterações funcionais.

### Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Lançamentos novos com `center_cost` não aparecerem em Faturas Projetadas se o nome não estiver em `CARD_INVOICE_CENTER_COSTS` | Item 8: tornar a verificação dinâmica via lista de cartões cadastrados |
| Usuário tentar editar parcelas legadas em Lançamentos | Manter parcelas como linhas com ações limitadas (baixa/reverter) e badge "legado"; documentar visualmente |
| Quebra de links/bookmarks para `/compras-cartao` | Rota cai no `NotFound` (comportamento aceitável conforme PRD) |
| Duplicidade visual em Lançamentos se uma compra parcelada legada também tiver `transaction` correspondente | Já tratado pela deduplicação por `id` em `useCardInvoiceTransactionsQuery`; em Lançamentos, parcelas e transactions não compartilham IDs |

### Critérios de aceite mapeados
- ✅ Menu/rota/tela "Compras no Cartão" removidos (itens 1, 2, 3)
- ✅ Lançamentos de cartão operáveis em Lançamentos (item 5, 6 — campo cartão + parcela já editáveis)
- ✅ Filtro por cartão e busca por dados de cartão (item 6)
- ✅ Parcelamento exibido como X/Y (já existe via `InstallmentBadge`)
- ✅ Faturas Projetadas continuam consistentes (item 8 — fonte dinâmica)
- ✅ Sem duplicidade (deduplicação existente preservada)

