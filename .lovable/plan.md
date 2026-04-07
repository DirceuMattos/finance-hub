

## Plano: Corrigir parsing de Tipo e Valor no importador CSV

### Problema
1. **Tipo inválido ("Desp")**: O CSV usa abreviações como "Desp" (despesa) e "Rec" (receita), mas o sistema espera `income`/`expense`/`transfer`. Como as categorias já possuem `transaction_nature` (income/expense), o tipo pode ser derivado da categoria.
2. **Valor inválido ("R$38,12")**: O campo contém o símbolo "R$" que não é removido antes do parsing numérico.

### Solução

**Arquivo: `src/components/lancamentos/CsvImportDialog.tsx`**

1. **Valor — limpar símbolo de moeda**: Na função `parseBrNumber`, remover prefixos como `R$` e espaços antes de processar o número.

2. **Tipo — derivar da categoria**: Em vez de exigir `income`/`expense`/`transfer` no CSV, buscar o campo `transaction_nature` das categorias. Ao fazer o fetch de categorias, incluir `transaction_nature` no select. Se a categoria for encontrada, usar seu `transaction_nature` como `transaction_type`. Se não for encontrada ou não tiver nature, usar mapeamento de fallback: `desp`→`expense`, `rec`→`income`. Remover a validação que rejeita valores diferentes de `income`/`expense`/`transfer`.

3. **Ajuste no select de categorias**: Mudar de `select("id, name")` para `select("id, name, transaction_nature")` e guardar o nature no mapa junto com o id.

### Resultado
- Linhas com "Desp" ou "Rec" no tipo serão aceitas via mapeamento
- Valores como "R$ 1.500,00" ou "R$38,12" serão parseados corretamente
- Prioridade: `transaction_nature` da categoria > mapeamento do CSV

