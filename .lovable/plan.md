

## Plano: Correção dos 3 problemas nos módulos Lançamentos e Compras no Cartão

### Diagnóstico

**Problema 2 e 3 (Compras no Cartão vazia + parcelas de cartão ausentes em Lançamentos):**
Causa raiz: **limite padrão de 1000 linhas do Supabase**. O hook `useCardInstallments()` busca TODOS os registros da tabela `card_installments` ordenados por `billing_month ASC`. Como há dados históricos desde 2023, as 1000 primeiras linhas cobrem apenas os meses antigos, e os meses recentes (como abril/2026) nunca são retornados. O filtro client-side então não encontra dados para o mês atual.

**Problema 1 (todos os lançamentos com status "Cancelado"):**
Preciso verificar se é um bug visual ou se os registros do mês filtrado realmente possuem status `cancelled` no banco. O código do `StatusBadge` está correto — se `status !== "paid"` e `status !== "cancelled"`, exibe "Previsto". Vou verificar na implementação e corrigir se necessário.

### Correções

#### 1. Corrigir o limite de 1000 linhas no `useCardInstallments`

**Arquivo:** `src/hooks/useCardInstallments.ts`

Adicionar `.limit(5000)` à query para garantir que todos os registros sejam retornados. Alternativamente, inverter a ordenação para `desc` e aplicar um filtro server-side por range de meses relevantes. A abordagem mais segura é usar filtro server-side para buscar apenas o que é necessário.

A query da página ComprasCartao (que não passa parâmetros) buscará os últimos 24 meses por padrão. A query usada em Lancamentos fará o mesmo.

#### 2. Corrigir o filtro de card installments na query do hook `useCardInvoiceTransactions`

**Arquivo:** `src/hooks/useCardInvoiceTransactions.ts`

Mesmo problema de limite de 1000 linhas na query de `card_installments` (linha 70-73). Adicionar `.limit(5000)` ou filtro por range de datas.

#### 3. Verificar e corrigir o problema de status em Lançamentos

**Arquivo:** `src/pages/Lancamentos.tsx`

Verificar se o filtro por mês está resultando em transações que realmente têm status "cancelled", ou se há um bug de renderização. Se for um problema visual, corrigir o `StatusBadge` ou o mapeamento de status.

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCardInstallments.ts` | Adicionar limite ou filtro server-side de data |
| `src/hooks/useCardInvoiceTransactions.ts` | Mesmo ajuste de limite/filtro |
| `src/pages/Lancamentos.tsx` | Verificar e corrigir bug de status (se confirmado) |
| `src/pages/ComprasCartao.tsx` | Ajustar filtro padrão se necessário |

### Sem alterações no banco de dados

Todas as correções são no frontend.

