

## Plano: Ativar CRUD completo e gráfico no módulo Patrimônio

### Estado atual

A página `Patrimonio.tsx` já tem listagem read-only com tabs Pessoal/Empresa/Consolidado, stat cards e tabela. O hook `usePatrimony.ts` tem queries de leitura (`usePatrimonySnapshots`, `usePatrimonyEvolution`, `useAssetCategories`). Falta CRUD e gráfico de evolução.

### Alterações

| Arquivo | Ação |
|---|---|
| `src/hooks/usePatrimony.ts` | Adicionar mutations `create`, `update`, `remove` para `patrimony_snapshots` |
| `src/components/patrimonio/PatrimonyForm.tsx` | **Criar** — formulário em drawer para criar/editar snapshot |
| `src/pages/Patrimonio.tsx` | Adicionar botão "Novo", ações editar/excluir na tabela, gráfico de evolução, mensagem de histórico insuficiente |

### Detalhes

**1. `usePatrimony.ts` — adicionar CRUD**
- `createSnapshot`: insert em `patrimony_snapshots` com campos `reference_month`, `item_name`, `asset_category_id`, `financial_entity_id`, `opening_value`, `closing_value`, `notes`
- `updateSnapshot`: update por `id`
- `removeSnapshot`: delete por `id`
- Invalidar queryKey `patrimony_snapshots` e `vw_patrimony_evolution` no success
- Padrão idêntico ao `useFinancialEntities` (mutations com toast)

**2. `PatrimonyForm.tsx` — formulário em drawer**
- Usa `FormDrawer` existente
- Campos: Mês referência (input month), Item (text), Categoria (select de `useAssetCategories`), Entidade (select de `useFinancialEntities`), Valor abertura (number), Valor fechamento (number), Notas (textarea)
- Modo criação e edição (preenche form com dados do snapshot selecionado)
- Validação com Zod: item_name required, closing_value required, reference_month required

**3. `Patrimonio.tsx` — CRUD + gráfico**
- Botão "Novo registro" no `PageHeader` abre drawer
- Colunas de ação na tabela: editar (Pencil) e excluir (Trash2)
- Excluir usa `DeleteDialog` existente
- Gráfico de evolução: `LineChart` do Recharts usando `vw_patrimony_evolution`
  - Eixo X: `reference_month` formatado
  - Linhas: `total_assets`, `total_liabilities`, `net_patrimony`
  - Respeita filtro de entidade (pessoal/empresa/consolidado com agregação)
  - Se `< 2 meses` de dados: exibir "Histórico insuficiente para análise"
- Gráfico posicionado entre stat cards e tabela

### O que NAO sera feito
- Zero alteração no banco/schema
- Zero recálculo — evolução vem de `vw_patrimony_evolution`
- Nenhuma tabela nova

