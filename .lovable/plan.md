

## Plano: Padronizar exibição de valores negativos em todo o sistema

### Regra universal
Todo campo monetário que puder ser negativo deve exibir `text-destructive font-medium` quando `< 0`.

### Arquivos e alterações

**1. `src/pages/Investimentos.tsx`**
- Coluna `opening_value` (linha 172): adicionar classe condicional para negativos
- Coluna `closing_value` (linha 179): adicionar classe condicional para negativos
- StatCards (linhas 249-252): adicionar `variant` condicional (`negative` quando `< 0`) em Retorno Estimado e Carteira Total

**2. `src/pages/Patrimonio.tsx`**
- Coluna `opening_value` (linha 147): adicionar classe condicional para negativos (closing_value já está correto)
- StatCards de Ativos/Passivos/Líquido: adicionar `variant` condicional para patrimônio líquido negativo

**3. `src/pages/Lancamentos.tsx`**
- Coluna `amount` (linha 185): manter verde para receita, adicionar `text-destructive` para valores negativos em despesas

**4. `src/pages/Recorrencias.tsx`**
- Coluna `amount` (linha 49): adicionar `text-destructive` quando valor for negativo

**5. `src/pages/ComprasCartao.tsx`**
- Coluna `total_amount` (linha 74): adicionar classe condicional para negativos
- Coluna `installments` (linha 75): adicionar classe condicional para `installment_amount` negativo

**6. `src/pages/FaturasProjetadas.tsx`**
- Coluna `total_amount` (linha 98): adicionar classe condicional para negativos

**7. `src/pages/FluxoMensal.tsx`**
- Coluna `projected_card_amount` (linha 92): adicionar classe condicional (saldo líquido já está correto)

**8. `src/components/shared/StatCard.tsx`**
- Já suporta `variant="negative"` com cor vermelha — nenhuma alteração necessária no componente

**9. `src/pages/Dashboard.tsx`**
- StatCard "Saldo Atual" (linha 175-181): adicionar `variant` condicional quando saldo negativo

### Padrão de código
```tsx
// Tabelas
<span className={value < 0 ? "text-destructive font-medium" : ""}>{fmt(value)}</span>

// StatCards
<StatCard ... variant={value < 0 ? "negative" : "neutral"} />
```

~15 pontos de alteração em 8 arquivos. Nenhuma lógica de negócio modificada.

