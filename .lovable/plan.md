
Objetivo: desfazer a troca para o proxy do cliente e restaurar a conexão original com o banco externo, alterando somente o que você especificou.

### 1. Recriar o cliente legado em `src/lib/supabaseClient.ts`
Criar novamente o arquivo com exatamente este conteúdo:

```ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://tabjmrdsadodghvqoqcp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eGkMsSSEp9zbibsm0AsMAw_O6IhSv8n";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

### 2. Reverter imports em `src/hooks/`
Substituir os imports que hoje apontam para `@/integrations/supabase/client` para voltarem a usar `@/lib/supabaseClient` em todos os hooks afetados dentro de `src/hooks/`.

Escopo confirmado pelos arquivos atuais:
- `useAccounts.ts`
- `useAlerts.ts`
- `useAuth.ts`
- `useCardInstallments.ts`
- `useCardInvoiceTransactions.ts`
- `useCardPurchases.ts`
- `useCards.ts`
- `useCategories.ts`
- `useDashboardData.ts`
- `useFinancialEntities.ts`
- `useInvestmentClassesCrud.ts`
- `useInvestments.ts`
- `useMonthlyCashflow.ts`
- `usePatrimony.ts`
- `useRecurrences.ts`
- `useRepairInstallments.ts`
- `useSystemParameters.ts`
- `useTransactions.ts`
- `useUsers.ts`

### 3. Preservar `Dashboard.tsx` como está
Não alterar `src/pages/Dashboard.tsx`, que deve continuar importando de `@/integrations/supabase/client`, conforme sua instrução.

### 4. Remover o redirecionamento global para o proxy
Reverter apenas as mudanças que desviaram `@/integrations/supabase/client` para `src/lib/supabase-client-proxy.ts`, para que esse atalho deixe de interferir no restante do app:
- `vite.config.ts`: remover o alias regex que redireciona `@/integrations/supabase/client`
- `tsconfig.json`: remover o path mapping de `@/integrations/supabase/client`
- `tsconfig.app.json`: remover o path mapping de `@/integrations/supabase/client`

Isso é necessário porque, se o alias continuar ativo, o `Dashboard.tsx` continuará indo para o proxy mesmo sem mexer no import.

### 5. Não alterar mais nada
Fora os itens acima:
- não mexer no arquivo gerado `src/integrations/supabase/client.ts`
- não alterar lógica de negócio
- não alterar queries, hooks, páginas ou backend além dos imports e da restauração do cliente legado
- não mudar o `Dashboard.tsx`

### Resultado esperado
- os hooks e utilitários voltam a usar `@/lib/supabaseClient`
- o Dashboard permanece no cliente integrado atual
- o redirecionamento global para o proxy deixa de afetar a resolução dos imports
- a conexão com o banco legado é restaurada apenas nos pontos solicitados
