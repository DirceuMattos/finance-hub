

## Plano: Importação de CSV de Lançamentos Comuns

### O que será feito
Uma funcionalidade de importação de CSV na página de Lançamentos, acessível por um botão "Importar CSV". O sistema lerá o arquivo, mapeará os nomes de contas/categorias/entidades para seus UUIDs e inserirá os registros no banco.

### Mapeamento CSV → Banco

| Coluna CSV | Coluna DB | Transformação |
|---|---|---|
| `competence_date` | `competence_date` | DD/MM/YYYY → YYYY-MM-DD |
| `transaction_type` | `transaction_type` | Direto (income/expense/transfer) |
| `Description` | `description` | Direto |
| `payee` | `payee` | Direto |
| `Valor` | `amount` | 1.500,00 → 1500.00 |
| `Vencimento` | `due_date` | DD/MM/YYYY → YYYY-MM-DD |
| `Observação` | `notes` | Direto |
| `Conta` | `account_id` | Buscar UUID pelo nome na tabela `accounts` |
| `Categoria` | `category_id` | Buscar UUID pelo nome na tabela `categories` |
| `Entidade Financeira` | `financial_entity_id` | Buscar UUID pelo nome na tabela `financial_entities` |

**Status automático**: se `Vencimento` ≤ hoje → `paid` (com `payment_date` = `due_date`), senão → `planned`.

### Alterações técnicas

**1. Novo componente `src/components/lancamentos/CsvImportDialog.tsx`**
- Dialog com input de arquivo CSV
- Ao carregar: parseia CSV, busca tabelas de referência (accounts, categories, financial_entities), mapeia nomes → UUIDs
- Exibe preview dos dados mapeados com indicação de erros (ex: conta não encontrada)
- Botão "Importar" insere em lote via `supabase.from("transactions").insert(rows)`
- Exibe resumo: X importados, Y erros

**2. Página `src/pages/Lancamentos.tsx`**
- Adicionar botão "Importar CSV" ao lado dos botões existentes no header
- Integrar o dialog de importação

**3. Nenhuma alteração no banco** — as colunas já existem.

