
Objetivo: eliminar o cliente Supabase hardcoded, padronizar toda a aplicação no cliente gerado em `@/integrations/supabase/client`, e expor a página `Alertas` via rota protegida e navegação lateral.

### 1. Unificar o cliente Supabase
Remover o arquivo legado:
- `src/lib/supabaseClient.ts`

Substituir todos os imports de:
- `@/lib/supabaseClient`

por:
- `@/integrations/supabase/client`

Isso inclui imports estáticos e dinâmicos. Pelos arquivos encontrados, a troca precisa cobrir ao menos:
- `src/pages/Login.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Relatorios.tsx` (import dinâmico)
- `src/hooks/useAuth.ts`
- `src/hooks/useAccounts.ts`
- `src/hooks/useAlerts.ts`
- `src/hooks/useCards.ts`
- `src/hooks/useCardInstallments.ts`
- `src/hooks/useCardInvoiceTransactions.ts`
- `src/hooks/useCardPurchases.ts`
- `src/hooks/useCategories.ts`
- `src/hooks/useDashboardData.ts`
- `src/hooks/useFinancialEntities.ts`
- `src/hooks/useInvestmentClassesCrud.ts`
- `src/hooks/useInvestments.ts`
- `src/hooks/useMonthlyCashflow.ts`
- `src/hooks/usePatrimony.ts`
- `src/hooks/useRecurrences.ts`
- `src/hooks/useRepairInstallments.ts`
- `src/hooks/useTransactions.ts`
- `src/hooks/useUsers.ts`
- `src/components/configuracoes/AccountsTab.tsx`

### 2. Preservar o cliente correto baseado em variáveis de ambiente
Validar que `src/integrations/supabase/client.ts` continue exatamente no padrão já correto:
- `import.meta.env.VITE_SUPABASE_URL`
- `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`

Nenhuma mudança estrutural nesse arquivo além de eventual conferência. O objetivo é que ele permaneça como única fonte de verdade.

### 3. Registrar a rota da página Alertas
Atualizar `src/App.tsx` para:
- importar `Alertas`
- adicionar a rota protegida:
  - `/alertas`
  - usando `<ProtectedRoute><Alertas /></ProtectedRoute>`

A rota deve ficar no mesmo bloco das demais páginas autenticadas, seguindo o padrão atual do app.

### 4. Adicionar “Alertas” ao menu lateral
Atualizar `src/components/layout/AppSidebar.tsx` para:
- importar o ícone `Bell` de `lucide-react`
- inserir o item:
  - título: `Alertas`
  - url: `/alertas`
  - ícone: `Bell`

Posição solicitada:
- logo após `Dashboard`, ainda dentro do grupo `Visão Geral`

### 5. Verificações de consistência após a implementação
Após aplicar as mudanças, validar:
- não restou nenhum import para `@/lib/supabaseClient`
- o import dinâmico de `Relatorios.tsx` também foi ajustado
- `Alertas` aparece no menu lateral
- `/alertas` abre normalmente quando autenticado
- fluxo de login/reset/auth continua usando o mesmo cliente unificado

### Arquivos previstos para alteração
- `src/App.tsx`
- `src/components/layout/AppSidebar.tsx`
- todos os arquivos que ainda importam `@/lib/supabaseClient`
- remoção de `src/lib/supabaseClient.ts`

### Resultado esperado
- um único cliente Supabase em todo o projeto
- nenhuma chave hardcoded no frontend
- página `Alertas` acessível por URL e pelo menu lateral
- base de código mais segura e consistente, sem duplicidade de integração
