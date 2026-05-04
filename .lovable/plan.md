## Objetivo
Corrigir a exportação CSV/XLSX de Lançamentos no módulo Relatórios.

## Arquivo único alterado
`src/pages/Relatorios.tsx`

## Mudanças

### 1. Pré-processar `filteredTx` antes de exportar
Criar `exportTx` (via `useMemo`) que mapeia cada transação para um objeto plano com os campos finais já traduzidos/formatados:

- `due_date_fmt`: `due_date` formatado como `DD/MM/AAAA` (vazio se nulo)
- `payment_date_fmt`: `payment_date` formatado como `DD/MM/AAAA` (vazio se nulo)
- `description`: igual
- `type_label`: `"Receita"` se `transaction_type === "income"`, `"Despesa"` se `"expense"`
- `payee`: igual
- `category_name`: `categories?.name`
- `entity_name`: `financial_entities?.name`
- `account_name`: `accounts?.name`
- `card_name`: `cards?.name ?? ""` (campo pode estar ausente no fetch atual; permanecerá vazio sem quebrar)
- `status_label`: `paid → "Realizado"`, `planned → "Previsto"`, `cancelled → "Cancelado"` (fallback no original)
- `receita`: `Number(amount)` se income, senão `""` (string vazia para célula em branco)
- `despesa`: `Number(amount)` se expense, senão `""`

### 2. Substituir `txColumns` pela nova ordem
```ts
const txColumns = [
  { key: "due_date_fmt",     header: "Vencimento" },
  { key: "payment_date_fmt", header: "Data Pagamento" },
  { key: "description",      header: "Descrição" },
  { key: "type_label",       header: "Tipo" },
  { key: "payee",            header: "Favorecido" },
  { key: "category_name",    header: "Categoria" },
  { key: "entity_name",      header: "Entidade" },
  { key: "account_name",     header: "Conta" },
  { key: "card_name",        header: "Cartão" },
  { key: "status_label",     header: "Status" },
  { key: "receita",          header: "Receita" },
  { key: "despesa",          header: "Despesa" },
];
```

Coluna "Mês do Evento" (`competence_date`) removida. Coluna única "Valor" substituída por "Receita"/"Despesa" como números (permite SOMA na planilha).

### 3. Passar `exportTx` para `<ExportButtons data={...} />` da seção Lançamentos
O contador de registros continua refletindo a mesma quantidade.

## Sem alterações em
- `src/lib/exportUtils.ts` (já trata números corretamente via `aoa_to_sheet`)
- Hooks de dados
- Outras seções do relatório (Cartões, Investimentos, Patrimônio, Recorrências)
