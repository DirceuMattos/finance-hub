

## Plano: Correção dos saldos no Dashboard e Recálculo de Contas

### Diagnóstico

Após análise detalhada do código, identifiquei três problemas raiz:

1. **Dashboard depende de views do banco externo (`vw_monthly_cashflow_*`)** que podem estar com lógica incorreta ou desatualizada. O `useDashboardData.ts` lê diretamente dessas views para obter receitas, despesas, saldo projetado e valores de cartão. Se as views estão erradas, tudo no Dashboard fica errado.

2. **O hook `useMonthlyCashflow` (usado no Fluxo Mensal) soma TODAS as parcelas de cartão como `projected_card_amount`**, sem distinguir se estão pagas ou previstas. Isso infla o comprometimento de cartão.

3. **O botão Recalcular Saldos considera apenas `transactions`**, o que é correto se pagamentos de fatura de cartão são registrados como transações de despesa. Porém, não há log ou transparência para o usuário verificar o cálculo.

### Alterações

**1. `src/hooks/useDashboardData.ts` — Eliminar dependência das views**

Substituir a leitura das views `vw_monthly_cashflow_*` por cálculo direto no frontend (mesmo padrão do `useMonthlyCashflow`), garantindo que:
- Receitas pagas = transações `income` + `status = paid` no mês
- Receitas previstas = transações `income` + `status = planned` no mês
- Despesas pagas = transações `expense` + `status = paid` no mês
- Despesas previstas = transações `expense` + `status = planned` no mês
- Cartão previsto = parcelas `card_installments` com `status != paid` no mês
- Cartão pago = parcelas com `status = paid` no mês (informativo)
- Saldo projetado = (receitas pagas + previstas) - (despesas pagas + previstas) - cartão previsto
- Semáforo calculado com base no saldo projetado vs reserva mínima

**2. `src/hooks/useMonthlyCashflow.ts` — Separar cartão pago vs previsto**

Corrigir para que `projected_card_amount` conte apenas parcelas **não pagas** (previstas/pendentes), e adicionar campo `card_paid_amount` para parcelas já pagas.

**3. `src/components/configuracoes/AccountsTab.tsx` — Adicionar log de recálculo**

Após recalcular, exibir toast detalhado com o resumo: número de contas processadas e o total de transações consideradas, para que o usuário possa validar.

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Substituir leitura de views por cálculo direto de `transactions` + `card_installments` |
| `src/hooks/useMonthlyCashflow.ts` | Separar parcelas pagas vs previstas no cálculo de cartão |
| `src/components/configuracoes/AccountsTab.tsx` | Toast com resumo do recálculo |

### Sem alterações no banco de dados

Todo o trabalho é exclusivamente frontend. As tabelas `transactions` e `card_installments` já contêm os dados necessários.

