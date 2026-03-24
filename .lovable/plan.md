

## Plano: Integração completa do módulo de Cartões via `center_cost`

### Diagnóstico

O código atual já filtra por `center_cost` no hook `useCardInvoiceTransactions`, mas há dois problemas:

1. **Valores de `center_cost` inconsistentes** — O código usa `"Cartão de Crédito - Prof."` (singular) mas os dados reais no banco usam `"Cartões de Crédito - Prof."` (plural). Precisa suportar ambas as variantes.
2. **Dados subutilizados** — As telas de Cartões e Faturas Projetadas consomem os dados mas não exibem resumos ricos (histórico vs. futuro, contagens).

### Alterações por arquivo

**1. `src/lib/cardInvoiceRules.ts`**
- Incluir ambos os formatos (singular e plural) nos arrays de `center_cost` para cobrir variações nos dados
- Adicionar mapeamento `CENTER_COST_ENTITY_MAP` (center_cost → "personal"/"business")
- Adicionar `CUTOFF_DATE` para regra temporal de leitura UX

**2. `src/hooks/useCardInvoiceTransactions.ts`**
- Expor dados separados: total histórico (paid), total futuro (planned), contagem por cartão
- Nova função `useCardInvoiceSummaryByCard()` retornando `{ paidTotal, plannedTotal, count }` por cartão
- Aplicar regra temporal UX: `competence_date <= 2026-02-25` = histórico, `>= 2026-02-26` = futuro (sem sobrescrever status do banco)

**3. `src/pages/Cartoes.tsx`**
- Adicionar seção resumo por cartão: total histórico, total futuro previsto, contagem de lançamentos
- Manter barras de progresso existentes (uso do limite)
- Nota contextual: "Dados calculados a partir de lançamentos identificados por centro de custo"

**4. `src/pages/FaturasProjetadas.tsx`**
- Exibir leitura auxiliar de pagamentos históricos/futuros de cartão vindos de `transactions.center_cost`
- Nota contextual: "Dados provenientes de lançamentos por centro de custo. Parcelas detalhadas dependem de carga em Compras no Cartão"
- Sem inventar parcelas

**5. `src/pages/ComprasCartao.tsx`**
- Adicionar nota contextual informando que dados atuais de cartão vêm de `transactions.center_cost` e que compras parceladas detalhadas dependem de carga em `card_purchases`

**6. `src/pages/Lancamentos.tsx`**
- Descrição de card invoice: "Pagamento de Fatura — BRA Pessoal" / "Pagamento de Fatura — Nu Infotkt"
- Adicionar filtros por cartão específico (BRA Pessoal / Nu Infotkt) no dropdown de fatura de cartão
- Manter registros como transactions, sem conversão

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/lib/cardInvoiceRules.ts` | Suportar variantes singular/plural, entity map, cutoff |
| `src/hooks/useCardInvoiceTransactions.ts` | Resumo por cartão (histórico/futuro/contagem) |
| `src/pages/Cartoes.tsx` | Totais histórico/futuro, contagem, nota contextual |
| `src/pages/FaturasProjetadas.tsx` | Leitura auxiliar de transactions, nota contextual |
| `src/pages/ComprasCartao.tsx` | Nota contextual sobre fonte dos dados |
| `src/pages/Lancamentos.tsx` | Rótulo "Pagamento de Fatura", filtro por cartão |

Sem alteração no banco. Sem novas tabelas. Sem duplicação de dados.

