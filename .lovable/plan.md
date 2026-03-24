

## Plano: Ativar CRUD e gráfico no módulo Investimentos

### Estado atual

A página `Investimentos.tsx` já tem listagem read-only com tabs Pessoal/Empresa/Consolidado, stat cards, alocação por classe e tabela detalhada. O hook `useInvestments.ts` tem queries de leitura para `investment_snapshots`, `vw_investment_return_by_class` e `vw_investment_portfolio_summary`. Falta CRUD e gráfico de evolução.

### Alterações

| Arquivo | Ação |
|---|---|
| `src/hooks/useInvestments.ts` | Adicionar mutations `create`, `update`, `remove` para `investment_snapshots` + hook `useInvestmentCrud` |
| `src/components/investimentos/InvestmentForm.tsx` | **Criar** — formulário drawer para criar/editar snapshot (padrão PatrimonyForm) |
| `src/pages/Investimentos.tsx` | Adicionar botão "Novo registro", ações editar/excluir na tabela, gráfico de evolução (LineChart), mensagem histórico insuficiente |

### Detalhes

**1. `useInvestments.ts` — CRUD**
- `useInvestmentCrud()` retorna `{ create, update, remove }` — mesmo padrão de `usePatrimonyCrud`
- Insert/update/delete em `investment_snapshots` com campos: `reference_month`, `investment_class_id`, `financial_entity_id`, `opening_value`, `closing_value`
- Invalidar queries: `investment_snapshots`, `vw_investment_return_by_class`, `vw_investment_portfolio_summary`
- Toast de sucesso/erro

**2. `InvestmentForm.tsx`**
- `FormDrawer` com campos: Mês referência (input month), Classe (select de `useInvestmentClasses`), Entidade (select de `useFinancialEntities`), Valor abertura (number), Valor fechamento (number)
- Modo criação e edição
- Validação Zod: `investment_class_id`, `financial_entity_id`, `reference_month`, `closing_value` required

**3. `Investimentos.tsx` — CRUD + gráfico**
- Botão "Novo registro" no `PageHeader`
- Coluna de ações na tabela: editar (Pencil) e excluir (Trash2) — usar `DeleteDialog`
- Trocar fonte de dados da tabela de `vw_investment_return_by_class` para `investment_snapshots` (para ter `id` no CRUD), mantendo `vw_investment_return_by_class` para os stat cards e alocação
- Gráfico de evolução usando `vw_investment_portfolio_summary`:
  - LineChart (Recharts) com `total_portfolio_value` e `total_estimated_return` por mês
  - Respeita filtro de entidade (agregação no consolidado)
  - Se < 2 meses: "Histórico insuficiente para análise"
- Gráfico posicionado entre stat cards e alocação

### O que NÃO será feito
- Zero alteração no banco
- Zero lógica de cálculo no frontend — retorno estimado vem de `vw_investment_return_by_class`
- Nenhuma tabela nova

