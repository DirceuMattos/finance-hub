

## Plano: Restringir policies RLS "always true" sem quebrar o sistema

### Avaliação do warning

O linter aponta 6 policies em 2 tabelas globais de configuração no banco externo (mesmas tabelas existem no Cloud do Lovable, mas o app só usa o externo):

| Tabela | Policies INSERT/UPDATE/DELETE com `true` |
|---|---|
| `investment_classes` | insert, update, delete |
| `system_parameters` | insert, update, delete |

Hoje qualquer usuário autenticado (incluindo um usuário comum) pode criar, alterar ou excluir classes de investimento e parâmetros globais do sistema. Isso é risco real: um usuário não-admin poderia, por exemplo, alterar `system_parameters` que controlam regras de cálculo (taxa de juros, dia de fechamento de cartão padrão etc.) e impactar todos os outros usuários.

### Por que SELECT continua liberado

Leitura dessas tabelas é necessária para todos os usuários autenticados (formulários de investimento, regras de negócio carregadas pelo frontend). Mantemos `SELECT USING (true)` — o linter já ignora esse caso.

### Correção proposta — restringir mutações a administradores

O sistema já tem o conceito de admin via `users.is_admin` (vide `mem://auth/admin-provisioning`). Vou:

1. Criar uma função `SECURITY DEFINER` no banco externo:
```sql
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.users WHERE id = _user_id), false)
$$;
```

2. Substituir as 6 policies "always true" para exigir admin:
```sql
-- investment_classes
DROP POLICY auth_insert_investment_classes ON public.investment_classes;
DROP POLICY auth_update_investment_classes ON public.investment_classes;
DROP POLICY auth_delete_investment_classes ON public.investment_classes;

CREATE POLICY admin_insert_investment_classes ON public.investment_classes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY admin_update_investment_classes ON public.investment_classes
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY admin_delete_investment_classes ON public.investment_classes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- system_parameters (mesmo padrão)
```

### Avaliação de impacto — não quebra o sistema

| Fluxo | Tela | Quem usa hoje | Impacto |
|---|---|---|---|
| CRUD de Classes de Investimento | `Configuracoes → Classes de Investimento` | Admin (página é em Configurações, restrita) | Sem impacto — o usuário admin continua operando |
| CRUD de Parâmetros do Sistema | `Configuracoes → Parâmetros` | Admin | Sem impacto |
| Leitura em `InvestmentForm`, regras de cartão etc. | Todas | Todos os autenticados | Sem impacto — SELECT continua aberto |

Risco zero para usuários comuns, pois eles não acessam essas telas. Caso algum usuário não-admin tente mutar via DevTools, passará a receber 403 (correto).

### Onde aplicar

Como o app usa o **Supabase externo**, a migração precisa rodar **lá**, no SQL Editor do projeto externo. Vou entregar o SQL pronto para você colar (mesmo padrão das correções anteriores).

### Arquivos/passos

1. Entregar bloco SQL único (DROP + CREATE para as 6 policies + função `is_admin`) para você executar no Supabase externo.
2. Nenhuma alteração no frontend — os hooks `useInvestmentClassesCrud` e `useSystemParameters` continuam funcionando para o admin; para não-admins as telas já não são acessadas.
3. Após aplicar, marcar o finding `SUPA_rls_policy_always_true` como corrigido no painel.

### Riscos

| Risco | Mitigação |
|---|---|
| Nenhum usuário ainda marcado como `is_admin` no externo | Verificar com `SELECT id, email, is_admin FROM users WHERE is_admin=true;` antes de aplicar |
| Edge function `manage-users` usa service role e não é afetada | OK |

