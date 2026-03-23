

## Plano: 7 Ajustes no Dashboard, Lançamentos e Fluxo Mensal

### 1. Dashboard — Filtro por mês

**Arquivo:** `src/pages/Dashboard.tsx`, `src/hooks/useDashboardData.ts`

- Adicionar seletor de mês/ano no topo (ao lado das tabs Consolidado/Pessoal/Empresarial)
- O hook `useDashboardData` passará a receber `selectedMonth: Date` em vez de usar `currentMonthRange()` fixo
- Todos os cards (saldo, receitas, despesas, projetado, cartão) respeitarão o mês selecionado
- Default: mês atual

### 2. Lançamentos — Ordenação por coluna

**Arquivo:** `src/components/shared/DataTable.tsx`, `src/pages/Lancamentos.tsx`

- Adicionar suporte a ordenação no `DataTable`: nova prop `sortable` na interface `Column`, estado `sortKey` + `sortDir` no componente
- Cabeçalhos clicáveis com ícone de seta (ArrowUpDown)
- Adicionar `sortable: true` e `sortValue` (função que extrai valor comparável) em todas as colunas de Lançamentos
- Ordenação client-side sobre os dados já filtrados

### 3. Lançamentos — Filtro por mês/ano em vez de intervalo de datas

**Arquivo:** `src/pages/Lancamentos.tsx`

- Substituir os dois DatePickers (De/Até) por um único seletor de Mês/Ano
- Usar `Select` com os últimos 12-24 meses ou um MonthPicker simples
- Ao selecionar um mês, filtrar `competence_date` dentro daquele mês
- Opção "Todos os meses" para ver tudo

### 4. Lançamentos — Separação receitas x despesas

**Arquivo:** `src/pages/Lancamentos.tsx`

- Adicionar tabs opcionais acima da tabela: "Todos" | "Receitas" | "Despesas"
- Quando selecionado, filtrar `transaction_type` automaticamente (integra com o filtro existente)

### 5. Lançamentos — Ordenação default por data crescente

**Arquivo:** `src/pages/Lancamentos.tsx`

- Estado inicial de `sortKey = "competence_date"` e `sortDir = "asc"`
- Ao abrir a tela, lançamentos já aparecem do mais antigo para o mais recente

### 6. Fluxo Mensal — Corrigir coluna Semáforo

**Arquivo:** `src/pages/FluxoMensal.tsx`

- Traduzir os valores do `traffic_light` para português com cores específicas:
  - `green` / `verde` → Badge verde "Saudável"
  - `yellow` / `amarelo` → Badge amarelo "Atenção"
  - `blue` / `azul` / `balanced` → Badge azul "Equilibrado"
  - `red` / `vermelho` → Badge vermelho "Crítico"
- Usar classes customizadas para cada cor

### 7. Fluxo Mensal — Clique no mês navega para Lançamentos

**Arquivo:** `src/pages/FluxoMensal.tsx`, `src/pages/Lancamentos.tsx`

- Na coluna "Mês" do Fluxo Mensal, tornar o texto um link clicável
- Ao clicar, navegar para `/lancamentos?mes=2026-03` (usando `useNavigate`)
- Em Lançamentos, ler o query param `mes` no mount e pré-selecionar o filtro de mês correspondente

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/shared/DataTable.tsx` | Suporte a ordenação por coluna (sortable, sortValue) |
| `src/pages/Dashboard.tsx` | Seletor de mês/ano |
| `src/hooks/useDashboardData.ts` | Receber mês selecionado como parâmetro |
| `src/pages/Lancamentos.tsx` | Filtro mês/ano, tabs receita/despesa, sort default, leitura de query param |
| `src/pages/FluxoMensal.tsx` | Semáforo em português com cores, clique no mês navega para lançamentos |

Sem alteração no banco.

