

## Plano: Módulo de Configurações com CRUD Funcional

### Visão Geral

Transformar a página de Configurações em um módulo com abas (Tabs), cada aba contendo uma tabela filtrável com operações de criar, editar e excluir registros via drawer lateral. Os dados serão consumidos do Supabase usando `react-query` para cache e revalidação.

### Estrutura de Arquivos

```text
src/
├── types/
│   └── database.ts              # Interfaces TypeScript para as 5 tabelas
├── hooks/
│   ├── useFinancialEntities.ts   # CRUD hook
│   ├── useAccounts.ts
│   ├── useCards.ts
│   ├── useCategories.ts
│   └── useSystemParameters.ts
├── components/configuracoes/
│   ├── FinancialEntitiesTab.tsx   # Tabela + filtro + ações
│   ├── FinancialEntityForm.tsx    # Formulário no drawer
│   ├── AccountsTab.tsx
│   ├── AccountForm.tsx
│   ├── CardsTab.tsx
│   ├── CardForm.tsx
│   ├── CategoriesTab.tsx
│   ├── CategoryForm.tsx
│   ├── SystemParametersTab.tsx
│   └── SystemParameterForm.tsx
└── pages/
    └── Configuracoes.tsx          # Reescrita com Tabs
```

### Detalhes Técnicos

**1. Tipos (types/database.ts)**
Interfaces locais para `FinancialEntity`, `Account`, `Card`, `Category`, `SystemParameter` com todos os campos descritos. Usadas para tipagem nos hooks e componentes.

**2. Hooks de CRUD (um por tabela)**
Cada hook usa `@tanstack/react-query` e expõe:
- `useQuery` para listagem (com joins relacionais via `.select("*, financial_entities(name)")` onde aplicável)
- `useMutation` para insert, update e delete
- Invalidação automática do cache após mutações
- Toast de sucesso/erro

Queries usam cast via `.from('table_name').select(...)` com `as unknown as Type[]` para contornar a ausência das tabelas no types.ts auto-gerado.

**3. Página Configurações**
- 5 abas: Entidades Financeiras, Contas, Cartões, Categorias, Parâmetros
- Cada aba renderiza seu componente Tab dedicado

**4. Componentes Tab (padrão repetido)**
Cada Tab contém:
- `FilterBar` com busca por texto
- `PageHeader` com botão "Novo"
- `DataTable` com colunas específicas, incluindo coluna de ações (editar/excluir)
- Badge para status ativo/inativo
- Ao clicar editar ou novo, abre `FormDrawer`

**5. Formulários no Drawer**
- Validação com `react-hook-form` + `zod`
- Campos obrigatórios marcados
- Selects relacionais (ex: entidade financeira no form de contas/cartões, categoria pai no form de categorias)
- Switch para campos booleanos (is_active, is_containable, etc.)
- Modo criar e editar no mesmo componente

**6. Campos por formulário:**

| Entidades Financeiras | Contas | Cartões | Categorias | Parâmetros |
|---|---|---|---|---|
| name | name | name | name | parameter_key |
| entity_type | bank_name | issuer_bank | parent_id (select) | parameter_value |
| is_primary | account_type | credit_limit | category_group | value_type |
| is_active | financial_entity_id (select) | managerial_limit | transaction_nature | |
| | opening_balance | closing_day | is_containable | |
| | current_balance | due_day | is_active | |
| | currency | financial_entity_id (select) | | |
| | is_active | is_active | | |

**7. Exclusão**
- Confirmação via `AlertDialog` antes de excluir
- Erros de FK (dependência) tratados no catch da mutation com toast informativo

### Dependências
Nenhuma nova dependência necessária. Usa `react-hook-form`, `zod`, `@hookform/resolvers` (já disponíveis), `@tanstack/react-query`, e componentes UI existentes.

