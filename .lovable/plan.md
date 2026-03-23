

## Plano: 4 Ajustes de UX — Status, Parâmetros, Logout e Tema

### 1. Lançamentos — Corrigir lógica de status

**Arquivo:** `src/pages/Lancamentos.tsx`

O problema está na função `resolveStatus` que sobrescreve o status do banco para lançamentos de cartão usando `getCardInvoiceStatus()`. Para lançamentos normais já usa `r.status` corretamente, mas para faturas de cartão infere o status pela data.

**Correção:**
- Alterar `resolveStatus` para usar **sempre** `r.status` vindo do banco
- Remover a chamada a `getCardInvoiceStatus` na resolução de status (manter apenas para identificação visual de fatura)
- O `StatusBadge` já está correto: `paid` → Realizado, `planned`/`pending` → Previsto, `cancelled` → Cancelado
- Ajustar o badge para aceitar `planned` como equivalente a `pending` (ambos = Previsto)

### 2. Parâmetros — Apresentação amigável

**Arquivo:** `src/components/configuracoes/SystemParametersTab.tsx`

Criar mapeamento `PARAMETER_LABELS`:

```text
reference_month          → "Mês de Referência" / "Mês base para cálculos do sistema"
minimum_reserve_personal → "Reserva Mínima Pessoal" / "Valor mínimo de reserva para finanças pessoais"
minimum_reserve_business → "Reserva Mínima Empresarial" / "Valor mínimo de reserva para a empresa"
surplus_investment_ratio  → "Proporção de Investimento" / "Percentual do superávit destinado a investimentos"
containment_reduction_target → "Meta de Redução" / "Meta percentual de contenção de despesas"
initial_consolidated_balance → "Saldo Inicial Consolidado" / "Saldo inicial para cálculo do fluxo consolidado"
default_patrimony_entity → "Entidade Padrão Patrimônio" / "Entidade financeira padrão para patrimônio"
default_investments_entity → "Entidade Padrão Investimentos" / "Entidade financeira padrão para investimentos"
primary_business_account → "Conta Principal Empresa" / "Conta bancária principal da empresa"
```

- Substituir coluna "Chave" por "Parâmetro" mostrando nome amigável (fallback para key original)
- Adicionar coluna "Descrição" com texto explicativo
- Manter coluna "Valor" e "Tipo"

### 3. Logout

**Arquivo:** `src/components/layout/AppSidebar.tsx`

- Adicionar botão "Sair" no rodapé do sidebar com ícone `LogOut`
- Chamar `supabase.auth.signOut()` ao clicar
- Redirecionar para `/` após logout

### 4. Modo claro/escuro

**Arquivos:** `src/hooks/useTheme.ts` (novo), `src/components/layout/AppLayout.tsx`

- Criar hook `useTheme` que gerencia classe `dark` no `<html>` e persiste em `localStorage`
- Adicionar botão toggle (Sun/Moon) no header do `AppLayout`, ao lado do título
- O CSS já possui variáveis `.dark` definidas em `index.css` — basta alternar a classe

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/pages/Lancamentos.tsx` | Usar `r.status` sempre, aceitar `planned` como Previsto |
| `src/components/configuracoes/SystemParametersTab.tsx` | Mapeamento amigável de nomes e descrições |
| `src/components/layout/AppSidebar.tsx` | Botão Logout no rodapé |
| `src/components/layout/AppLayout.tsx` | Toggle claro/escuro no header |
| `src/hooks/useTheme.ts` | Novo hook para gerenciar tema |

Sem alteração no banco.

