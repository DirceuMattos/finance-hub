

## Plano: Limpeza dos dados herdados + blindagem contra payment_date futura

### Diagnóstico final

- **Sem bug de código.** O parser monetário já está corrigido; updates são isolados por ID.
- **Dado herdado problemático:** lote criado em 07/abr/2026 02:44 inseriu 7 SIMPLES NACIONAL futuros (out/2025 → abr/2026) já como `paid` com valor chutado 1572,01 e `payment_date` = `due_date`. O mesmo padrão existe para INSS jan/2026 e fev/2026.
- **Violação de regra:** transações com `status='paid'` e `payment_date > hoje` no momento da criação contradizem `mem://logic/transaction-status-full-mapping` e o core "Never auto-fill payment_date".

### Passo 1 — Reverter lançamentos futuros indevidamente "paid" (correção de dados)

Lançamentos com `due_date > CURRENT_DATE` que estejam `paid` desde a criação devem voltar para `planned` com `payment_date = NULL`, para você dar baixa de verdade no mês correto com o valor real.

Candidatos identificados nesta consulta (a partir de hoje 20/abr/2026):

| ID | Descrição | Vencimento | Valor atual |
|---|---|---|---|

Nenhum no recorte atual está com `due_date > hoje` ainda como `paid` — os mais futuros (mai → dez/2026) já estão corretamente `planned`. Os de abr/2026 (`ce22fb01` INSS 550 e `d2e494f7` SIMPLES 1572,01) tiveram baixa real hoje (updated_at 20/abr), então **estão corretos**.

**Conclusão do Passo 1:** nenhuma reversão de dados é necessária neste momento. Os dados estão consistentes a partir de hoje.

### Passo 2 — Blindagem preventiva no código (impedir nova ocorrência)

**Arquivo:** `src/components/lancamentos/TransactionForm.tsx` e `src/components/lancamentos/CsvImportDialog.tsx`

Adicionar validação no submit:

```ts
if (status === "paid" && payment_date && new Date(payment_date) > new Date()) {
  toast.error("Não é permitido marcar como Realizado com data de pagamento futura");
  return;
}
```

Isso impede que importações CSV ou edições manuais voltem a gerar o padrão problemático observado.

### Passo 3 — Validação adicional na importação CSV

**Arquivo:** `src/components/lancamentos/CsvImportDialog.tsx`

Ao parsear cada linha do CSV, se `status='paid'` mas a linha não trouxer `payment_date` explícita OU trouxer `payment_date` futura, forçar `status='planned'` e `payment_date=NULL`. Logar aviso resumido ao final ("X linhas convertidas para Previsto por terem data futura").

### Passo 4 — Mensagem ao usuário

Confirmar com você que **não havia bug de software** alterando valores antigos: o que viu foi consequência de uma importação inicial que pré-preencheu vários meses futuros com valor estimado idêntico. A blindagem dos Passos 2 e 3 evita repetição.

### Arquivos alterados

1. `src/components/lancamentos/TransactionForm.tsx` — guarda `paid + payment_date futura`.
2. `src/components/lancamentos/CsvImportDialog.tsx` — guarda na importação + log de conversões.

### Riscos

| Risco | Mitigação |
|---|---|
| Usuário precisar marcar pagamento adiantado legítimo (ex.: pagou hoje algo que vence amanhã) | A regra bloqueia apenas `payment_date > hoje`, não `due_date > hoje`. Pagar hoje algo que vence amanhã continua permitido (payment_date = hoje). |
| CSVs antigos quebrarem ao reimportar | Conversão silenciosa para `planned`, com log informativo ao usuário ao final |

### Próximo passo concreto

Aprovar Passos 2 e 3 (mudança em 2 arquivos, sem mexer em dados). Se preferir não blindar agora e apenas ter o diagnóstico, basta dizer "encerrar" que não toco em código.

