# Gráfico de Evolução dos Investimentos no Dashboard

## Objetivo
Adicionar um novo card com gráfico de linha mostrando a evolução mensal do total investido, posicionado ao lado do card "Investimentos por Classe" no Dashboard.

## Mudanças

### 1. `src/hooks/useDashboardData.ts`
- Adicionar nova query `investmentEvolution` logo após `patrimonyEvolution`.
- A query lê `investment_snapshots` (campos `reference_month`, `closing_value`, `financial_entity_id`), ordena por mês e agrupa o total por mês.
- Respeita a `view` atual filtrando por `filterIds` quando não for "consolidated".
- Cada item retornado tem `{ month, total, label }` (label formatado "MMM yy" em pt-BR).
- Expor `investmentEvolution: investmentEvolution.data ?? []` no retorno do hook.

### 2. `src/pages/Dashboard.tsx`
- Desestruturar `investmentEvolution` do `useDashboardData`.
- No grid final (que hoje contém apenas "Investimentos por Classe" em `lg:grid-cols-2`), adicionar um segundo `<Card>` ao lado com:
  - Título "Evolução dos Investimentos".
  - `LineChart` (recharts, já importado) com altura 200, linha verde (`#10b981`), dataKey `total`.
  - Eixo Y formatado em "R$Xk", tooltip em moeda BRL completa.
  - Mensagem "Sem dados disponíveis" quando o array está vazio.

## Arquivos afetados
- `src/hooks/useDashboardData.ts`
- `src/pages/Dashboard.tsx`

Nenhum outro arquivo será alterado.
