

## Plano: Proteger a edge function `ai-financial-analysis`

### Problema
A função aceita requisições anônimas e processa qualquer payload, permitindo consumo indevido de créditos de IA e injeção de dados arbitrários no prompt.

### Correções

**Arquivo:** `supabase/functions/ai-financial-analysis/index.ts`

1. **Autenticação JWT obrigatória**
   - Ler header `Authorization` e rejeitar com `401` se ausente.
   - Criar cliente Supabase com `SUPABASE_URL` + `SUPABASE_ANON_KEY` e validar o token via `supabase.auth.getClaims(token)`.
   - Rejeitar com `401` se token inválido/expirado.

2. **Validação rigorosa de input**
   - Validar que `forecast`, `riskLevel` e `balance` existem (já feito) e adicionar validação de tipo numérico em todos os campos usados no prompt (`income_paid`, `income_planned`, `expense_paid`, `expense_planned`, `projected_balance`, `projected_card_amount`, `potential_containment`, `balance`, `patrimonyTotal`, `investmentTotal`).
   - Coagir cada campo com `Number(x)` e checar `Number.isFinite`. Se inválido, retornar `400`.
   - Sanitizar `riskLevel` para um enum fixo: `controlled | attention | critical`.
   - Limitar magnitudes (ex.: `Math.abs(v) <= 1e12`) para evitar prompts absurdos.

3. **CORS preservado** — mantém os headers atuais e responde `OPTIONS` antes de qualquer auth check.

4. **Frontend** (`src/pages/Dashboard.tsx`) — nenhuma alteração necessária. `supabase.functions.invoke()` já anexa o token do usuário logado automaticamente; como `Dashboard` está dentro de `ProtectedRoute`, sempre haverá sessão.

### Riscos
| Risco | Mitigação |
|---|---|
| Usuários sem sessão (improvável — rota protegida) receberiam 401 | Já bloqueado pelo `ProtectedRoute`; toast de erro existente cobre o caso |
| Validação de tipos quebrar chamadas legítimas | Coerção com `Number()` aceita strings numéricas; só rejeita NaN/infinito |

### Resumo
Um único arquivo alterado: `supabase/functions/ai-financial-analysis/index.ts`. Sem mudanças de banco, sem mudanças no frontend, sem novos secrets (todos os necessários já existem: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LOVABLE_API_KEY`).

