

## Plano: Módulo de Controle de Acessos (Login, Cadastro e MFA)

### Visão geral

Implementar autenticação completa usando o Supabase Auth do projeto externo já conectado (`src/lib/supabaseClient.ts`). Todas as rotas serão protegidas — usuários não autenticados serão redirecionados para a tela de login.

### Arquivos a criar

| Arquivo | Descrição |
|---|---|
| `src/pages/Login.tsx` | Tela de login com email/senha, link para cadastro e esqueceu senha |
| `src/pages/Signup.tsx` | Tela de cadastro com email, senha e confirmação de senha |
| `src/pages/ResetPassword.tsx` | Tela para definir nova senha (callback do email de reset) |
| `src/hooks/useAuth.ts` | Hook com estado de sessão, listener `onAuthStateChange`, loading |
| `src/components/auth/ProtectedRoute.tsx` | Wrapper que redireciona para `/login` se não autenticado |
| `src/pages/MfaSetup.tsx` | Tela para ativar TOTP MFA (exibe QR code, valida código) |
| `src/pages/MfaVerify.tsx` | Tela de verificação MFA pós-login (quando fator já está registrado) |

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/App.tsx` | Adicionar rotas `/login`, `/signup`, `/reset-password`, `/mfa-setup`, `/mfa-verify`; envolver rotas protegidas com `ProtectedRoute` |
| `src/components/layout/AppSidebar.tsx` | Exibir email do usuário logado no footer; manter botão Sair |

### Detalhes técnicos

**`useAuth.ts`**
- `onAuthStateChange` listener (configurado antes de `getSession`)
- Retorna `{ session, user, loading, signOut }`
- Verifica se sessão tem fator MFA pendente (`session.user.factors`)

**`ProtectedRoute.tsx`**
- Se `loading`: skeleton/spinner
- Se sem sessão: `Navigate to="/login"`
- Se sessão com MFA pendente (fator ativo mas não verificado na sessão): `Navigate to="/mfa-verify"`
- Senão: renderiza `children`

**`Login.tsx`**
- Formulário: email + senha
- `supabase.auth.signInWithPassword()`
- Após login, verificar se usuário tem fator TOTP ativo → redirecionar para `/mfa-verify`
- Links: "Criar conta" → `/signup`, "Esqueceu a senha?" → chama `resetPasswordForEmail`

**`Signup.tsx`**
- Formulário: email + senha + confirmar senha
- `supabase.auth.signUp()` (sem auto-confirm — usuário precisa verificar email)
- Mensagem: "Verifique seu email para confirmar o cadastro"

**`ResetPassword.tsx`** (rota `/reset-password`)
- Detecta `type=recovery` no URL hash
- Formulário: nova senha + confirmar
- `supabase.auth.updateUser({ password })`

**`MfaSetup.tsx`** (acessível via Configurações)
- `supabase.auth.mfa.enroll({ factorType: 'totp' })` → exibe QR code
- Input para código de verificação → `supabase.auth.mfa.challengeAndVerify()`
- Após sucesso: fator ativo

**`MfaVerify.tsx`** (tela pós-login quando MFA está ativo)
- `supabase.auth.mfa.challenge()` → obtém challenge
- Input de 6 dígitos → `supabase.auth.mfa.verify()`
- Após sucesso: redireciona para Dashboard

**Sidebar**
- Exibir `user.email` no footer acima do botão Sair
- Link "Segurança" nas Configurações para acessar MFA Setup

### Fluxo do usuário

```text
Usuário não logado → /login
  ├── Login com email/senha
  │   ├── Sem MFA → Dashboard
  │   └── Com MFA → /mfa-verify → Dashboard
  ├── "Criar conta" → /signup → confirmar email → /login
  └── "Esqueceu senha" → email enviado → /reset-password → /login

Usuário logado → Configurações → Segurança
  └── Ativar MFA → QR code → verificar código → MFA ativo
```

### O que NAO sera feito
- Nenhuma tabela de usuários customizada (usar `auth.users` do Supabase)
- Nenhum controle de roles/permissões (módulo simples conforme solicitado)
- Nenhuma alteração de schema

