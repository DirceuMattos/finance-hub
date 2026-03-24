

## Plano: Indicador de Risco Financeiro do Mês

### Conceito

Criar um card de destaque no topo do Dashboard com semáforo visual (Verde/Amarelo/Vermelho) que cruza três dados: resultado previsto do mês, total de cartão previsto, e reserva mínima configurada.

### Lógica do semáforo

```text
closingBalance = saldo_atual + forecast_result
reserveMin = minimum_reserve (do system_parameters, por view)
cardPlanned = soma dos cartões com status planned no mês

VERDE:  forecast_result > 0 AND closingBalance > reserveMin
AMARELO: forecast_result entre 0 e -5% da receita total
         OR closingBalance entre reserveMin e reserveMin * 1.1
         OR cardPlanned > 30% da despesa total do mês
VERMELHO: forecast_result < 0 OR closingBalance < reserveMin
```

### Alterações

**1. `src/hooks/useDashboardData.ts`**

- Adicionar query de `system_parameters` para buscar `minimum_reserve_personal` e `minimum_reserve_business`
- Retornar `reserveMin` (filtrado por view: personal, business, ou soma para consolidated)
- Calcular `riskLevel`: "controlled" | "attention" | "critical"
- Calcular `closingBalance`: `balance + forecast_result`
- Retornar `riskData: { level, closingBalance, reserveMin, cardPlannedTotal, forecastResult, message }`

**2. `src/pages/Dashboard.tsx`**

- Adicionar card de Risco Financeiro acima da linha operacional
- Visual: ícone de semáforo + cor de fundo (verde/amarelo/vermelho)
- Conteúdo:
  - Status: "Controlado" / "Atenção" / "Crítico"
  - Resultado previsto do mês
  - Total cartão previsto no mês
  - Reserva mínima
  - Mensagem curta contextual

Layout:
```text
[●] Risco Financeiro do Mês — CONTROLADO
Resultado previsto: R$ 2.340    Cartão previsto: R$ 4.127    Reserva mín.: R$ 10.000
"Mês controlado. Saldo de fechamento acima da reserva."
```

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/hooks/useDashboardData.ts` | Query system_parameters, cálculo de risco, retornar riskData |
| `src/pages/Dashboard.tsx` | Card de risco no topo com semáforo visual |

Sem alteração no banco. Sem novas tabelas.

