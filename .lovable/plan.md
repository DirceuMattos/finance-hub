

## Plano: Clarificar leitura de cartões no Dashboard

### Estado atual

O hook `useDashboardData` já agrupa corretamente por cartão e mês via `center_cost`, separa paid/planned pelo `status`, e filtra por `competence_date`. A lógica de dados está correta.

O problema é apenas de **clareza visual**: falta o total do mês por cartão e a apresentação não diferencia visualmente pago vs previsto.

### Alterações

**`src/pages/Dashboard.tsx`** — Seção de cartões

- Adicionar linha "Total do Mês" (pago + previsto) com destaque
- Aplicar cores semânticas: verde para pago, laranja/amarelo para previsto
- Remover contagem de lançamentos do dashboard (informação de detalhe, não executiva)
- Adicionar barra de proporção visual pago/previsto

Layout por cartão:
```text
[CreditCard icon] BRA Pessoal              Pessoal
─────────────────────────────────────────────
Pago:      R$ 3.245,60  (verde)
Previsto:  R$ 4.127,33  (amarelo)
[barra proporcional pago/previsto]
Total Mês: R$ 7.372,93  (destaque bold)
```

Nenhuma alteração no hook — a lógica de agrupamento e queries permanece idêntica.

### Arquivo alterado

| Arquivo | O que muda |
|---|---|
| `src/pages/Dashboard.tsx` | Redesenhar cards de cartão: total do mês, cores semânticas, remover contagem |

Sem alteração no banco. Sem novas queries.

