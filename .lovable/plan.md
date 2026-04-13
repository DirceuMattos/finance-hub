

## Plano: Pacote final de ajustes e correções

---

### Classificação dos itens

| # | Item | Tipo | Exige ajuste no banco? |
|---|------|------|----------------------|
| 1 | Dashboard — valores incorretos | Frontend (cálculo) | Não |
| 2 | Fluxo Mensal — totais incorretos | Frontend (cálculo) | Não |
| 3 | Faturas Projetadas — valores faltando | Frontend (lógica de agregação) | Não |
| 4 | Saldo atual das contas | Backend (function SQL) + Frontend | Sim — revisão da function `recalculate_account_balances` |
| 5 | Campo cartão no TransactionForm | Frontend (formulário) | Não |
| 6 | Datas de vencimento em Compras no Cartão | Frontend (cálculo de parcelas) | Não |
| 7 | Filtro por status + ordenação em Compras no Cartão | Frontend (UI) | Não |
| 8 | Filtro por status em Faturas Projetadas | Frontend (UI) | Não |
| 9 | Categorias do Patrimônio | Frontend (query) | Não |
| 10 | Transporte de saldos abertura/fechamento Patrimônio | Frontend (lógica) | Não |
| 11 | Flag de liquidez em Investimentos | Frontend (UI) + Backend (coluna) | Sim — adicionar coluna `has_quick_liquidity` em `investment_snapshots` |
| 12 | Busca global por módulo | Frontend (filtro) | Não |

---

### Ordem recomendada de execução

**Fase 1 — Base de dados (itens 4, 11)**
- Item 4: Revisar a function `recalculate_account_balances` para usar `opening_balance` + receitas pagas - despesas pagas - parcelas pagas (a function atual não soma `opening_balance`)
- Item 11: Migração para adicionar coluna `has_quick_liquidity boolean default false` em `investment_snapshots`

**Fase 2 — Cálculos e consistência (itens 1, 2, 3)**
- Item 1: No `useDashboardData`, o `projected_balance` deve incluir `card_paid_amount` na dedução total e o cálculo do semáforo deve considerar a reserva mínima corretamente
- Item 2: No `useMonthlyCashflow`, os totais do resumo (`totals`) consideram apenas `income_paid` e `expense_paid`, ignorando previstos. Corrigir para somar ambos (ou separar em 4 cards: receita prevista, receita realizada, despesa prevista, despesa realizada)
- Item 3: Na `useCardInvoiceProjections`, a agregação por chave `card_name_month` une paid + planned na mesma linha, o que mascara os valores individuais. Revisar para que `paid_amount` e `planned_amount` sejam calculados separadamente dentro de cada grupo

**Fase 3 — Módulos de cartão (itens 5, 6, 7, 8)**
- Item 5: No `TransactionForm.tsx`, substituir as opções hardcoded do campo `center_cost` por uma lista dinâmica usando `useCards()`, listando todos os cartões cadastrados
- Item 6: No `useCardPurchases`, validar que `calcInstallmentDates` está usando corretamente `due_day` do cartão (a lógica já existe — verificar se o cartão é carregado antes da criação)
- Item 7: Em `ComprasCartao.tsx`, adicionar `filterStatus` com opções "Todas", "Aberta", "Paga", "Vencida", "Cancelada" e garantir que a DataTable respeite a ordenação por `due_date` (já tem `defaultSortKey="due_date"`)
- Item 8: Em `FaturasProjetadas.tsx`, adicionar filtro por status ("Todos", "Pago", "Previsto", "Parcial")

**Fase 4 — Patrimônio e Investimentos (itens 9, 10, 11-UI)**
- Item 9: O `PatrimonyForm` já usa `useAssetCategories()` que busca `asset_categories` com `is_active=true`. Se o select mostra vazio, a tabela `asset_categories` pode estar sem dados — verificar e, se necessário, usar `supabase as any` para o import correto do client
- Item 10: No `PatrimonyForm`, o auto-preenchimento de `opening_value` já existe via `usePreviousPatrimonyClosingValue`. Revisar se o transporte está funcionando quando o `reference_month` é enviado no formato correto (`yyyy-MM-dd` vs `yyyy-MM`)
- Item 11 (UI): Adicionar coluna/badge "Liquidez Rápida" na tabela de Investimentos e checkbox no formulário

**Fase 5 — Busca global (item 12)**
- Em cada página com `FilterBar`, expandir o filtro de `search` para buscar em todos os campos visíveis:
  - **Lançamentos**: descrição, favorecido, categoria, entidade, conta, valor formatado
  - **Compras no Cartão**: descrição, favorecido, cartão, categoria, entidade
  - **Faturas Projetadas**: cartão, mês formatado
  - **Cartões**: nome, banco emissor, entidade
  - **Patrimônio**: item, categoria, entidade
  - **Investimentos**: classe, entidade
  - **Contas**: nome, banco, tipo, entidade
  - **Configurações (Categorias, Entidades, etc.)**: nome e campos relevantes

---

### Riscos de quebrar comportamento atual

| Risco | Mitigação |
|-------|-----------|
| Alterar `recalculate_account_balances` pode gerar saldos diferentes dos atuais | Recalcular após deploy e validar com o usuário |
| Expandir busca pode causar lentidão se houver muitos registros | Busca apenas nos dados já carregados em memória (filtro client-side), sem impacto de performance significativo |
| Mudar cálculo do Dashboard pode alterar semáforo de risco | Valores ficarão mais precisos — melhoria, não regressão |
| Adicionar coluna `has_quick_liquidity` exige migração | Coluna com default `false` é não-destrutiva |
| Substituir campo `center_cost` hardcoded por lista dinâmica de cartões muda o valor salvo | Manter compatibilidade: salvar como `card_id` ou manter o padrão de `center_cost` com mapeamento dinâmico |

---

### Detalhes técnicos por arquivo

**Arquivos modificados:**

| Arquivo | Alterações |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Incluir `card_paid_amount` no cálculo, revisar semáforo |
| `src/hooks/useMonthlyCashflow.ts` | Totais separados para previsto e realizado |
| `src/hooks/useCardInvoiceTransactions.ts` | Separar `paid_amount` e `planned_amount` na projeção |
| `src/pages/FluxoMensal.tsx` | Exibir 4 totais (receita/despesa x prevista/realizada) no resumo |
| `src/pages/FaturasProjetadas.tsx` | Adicionar filtro por status |
| `src/pages/ComprasCartao.tsx` | Adicionar filtro por status |
| `src/components/lancamentos/TransactionForm.tsx` | Campo cartão dinâmico via `useCards()` |
| `src/components/patrimonio/PatrimonyForm.tsx` | Corrigir formato de `reference_month` para query de abertura |
| `src/pages/Investimentos.tsx` | Badge de liquidez rápida |
| `src/components/investimentos/InvestmentForm.tsx` | Checkbox de liquidez |
| `src/components/configuracoes/AccountsTab.tsx` | Busca expandida |
| `src/pages/Lancamentos.tsx` | Busca em todos os campos |
| Todos os módulos com FilterBar | Busca multi-campo |

**Migração SQL:**

```sql
-- Corrigir recalculate_account_balances para incluir opening_balance
CREATE OR REPLACE FUNCTION public.recalculate_account_balances() ...
  new_balance := acc.opening_balance + income - expenses - card_paid;

-- Adicionar flag de liquidez
ALTER TABLE investment_snapshots 
  ADD COLUMN IF NOT EXISTS has_quick_liquidity boolean NOT NULL DEFAULT false;
```

