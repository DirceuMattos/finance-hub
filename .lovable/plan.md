

## Plano: Conectar ao Supabase Externo

### O que será feito
Criar um cliente Supabase dedicado apontando para o banco externo do usuário e redirecionar todos os hooks de dados para usá-lo.

### Implementação

**1. Criar `src/lib/supabaseClient.ts`**
- Cliente Supabase com URL `https://tabjmrdsadodghvqoqcp.supabase.co` e chave pública fornecida

**2. Atualizar import em 10 hooks**
Trocar `import { supabase } from "@/integrations/supabase/client"` por `import { supabase } from "@/lib/supabaseClient"` em:
- `useFinancialEntities.ts`
- `useAccounts.ts`
- `useCards.ts`
- `useCategories.ts`
- `useSystemParameters.ts`
- `useTransactions.ts`
- `useCardPurchases.ts`
- `useCardInstallments.ts`
- `useMonthlyCashflow.ts`
- `useDashboardData.ts`

### Resultado
Todas as telas passarão a ler dados reais do banco externo. Nenhuma tabela será criada ou alterada.

