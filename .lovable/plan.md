

## Plano: Módulo de Relatórios com Exportação

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/pages/Relatorios.tsx` | **Criar** — página com 5 seções de exportação, filtros e botões de download |
| `src/lib/exportUtils.ts` | **Criar** — utilitário genérico de exportação CSV/XLSX |
| `src/App.tsx` | **Modificar** — adicionar rota `/relatorios` |
| `src/components/layout/AppSidebar.tsx` | **Modificar** — adicionar link "Relatórios" no sidebar |

### Dependência

Instalar `xlsx` (SheetJS) para exportação XLSX.

### Estrutura da página `/relatorios`

5 seções em Accordion ou Tabs, cada uma com filtros específicos e botão "Exportar CSV" / "Exportar XLSX":

**1. Lançamentos**
- Filtros: mês/ano (select), conta (select from `useAccounts`), status (select), entidade (select from `useFinancialEntities`), categoria (select from `useCategories`)
- Query: `useTransactions` — filtragem no frontend (dados já carregados com joins)
- Colunas exportadas: Vencimento, Mês do Evento, Descrição, Tipo, Categoria (nome), Entidade (nome), Conta (nome), Valor, Status, Data Pagamento

**2. Recorrências**
- Sem filtros (tabela `recurrences` do banco externo — dados limitados por enquanto)
- Query direta: `supabase.from("recurrences").select("*")`
- Exportar todas as colunas disponíveis com nomes legíveis

**3. Cartões**
- Filtros: mês/ano, cartão (select from `useCards`)
- Query: `useCardPurchases` — filtrar por `purchase_date` e `card_id`
- Colunas: Data Compra, Descrição, Cartão (nome), Categoria (nome), Entidade (nome), Valor Total, Parcelas, Valor Parcela, Status

**4. Investimentos**
- Sem filtros complexos (exporta snapshot mais recente ou todos)
- Query: `useInvestmentSnapshots`
- Colunas: Mês Referência, Classe (nome), Entidade (nome), Valor Abertura, Valor Fechamento

**5. Patrimônio**
- Sem filtros complexos
- Query: `usePatrimonySnapshots`
- Colunas: Mês Referência, Item, Categoria (nome), Tipo Ativo, Entidade (nome), Valor Abertura, Valor Fechamento

### `exportUtils.ts`

Função genérica:
```
exportToFile(data: Record<string, any>[], columns: {key, header}[], filename: string, format: "csv" | "xlsx")
```
- CSV: gera string com headers + linhas, download via Blob
- XLSX: usa biblioteca `xlsx` (SheetJS) para criar workbook com headers e dados formatados

### Fluxo do usuário

1. Acessa `/relatorios`
2. Seleciona seção (ex: Lançamentos)
3. Aplica filtros desejados
4. Clica "Exportar XLSX" ou "Exportar CSV"
5. Download automático do arquivo com dados filtrados, usando nomes (não IDs)

### O que NÃO será feito
- Zero recálculo de lógica no frontend
- Nenhum dado simulado
- Nenhuma alteração de schema
- Nenhum backend novo

