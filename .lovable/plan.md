

## Plano: Exibição correta de saldos negativos em Contas

### Problema
O saldo atual já aceita valores negativos no formulário (sem restrição), mas a listagem não diferencia visualmente saldos negativos.

### Alterações

**`src/components/configuracoes/AccountsTab.tsx`**
- Na coluna `current_balance`, aplicar cor vermelha (`text-destructive`) quando o valor for negativo e verde/padrão quando positivo
- Mesma lógica para `opening_balance` se desejado

**Exemplo da renderização:**
```tsx
render: (r) => (
  <span className={r.current_balance < 0 ? "text-destructive font-medium" : ""}>
    {fmt(r.current_balance)}
  </span>
)
```

Alteração em 1 arquivo, ~3 linhas modificadas.

