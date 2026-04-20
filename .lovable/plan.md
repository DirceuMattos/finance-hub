

## Análise

### Comportamento atual
- **Lançamentos (`transactions`)**: o `TransactionForm` apenas salva **1 linha** com `installment_number` e `installment_total` como metadados informativos. **Não há geração de parcelas N+1…N**. Isso é um bug funcional — o usuário esperaria ver as 5 parcelas listadas.
- **Compras no Cartão (`card_purchases` + `card_installments`)**: este módulo **já funciona corretamente** — informando 5 parcelas, ele cria 1 registro pai em `card_purchases` e 5 filhos em `card_installments`, com `billing_month`/`due_date` calculados automaticamente. Aparecem na tela de Lançamentos via a "visão unificada" (mem://features/unified-transactions-view).
- **Recorrências**: serve para lançamentos **fixos repetitivos** (aluguel, salário) — frequência mensal/anual sem fim definido. Não é o lugar correto para parcelamento finito.

### Diagnóstico
| Caso | Hoje | Deveria ser |
|---|---|---|
| Compra parcelada **no cartão de crédito** | Usuário tenta lançar em "Lançamentos" → só 1 parcela | Usar **Compras no Cartão** (já gera as N parcelas) |
| Compra/despesa parcelada **fora de cartão** (boleto, financiamento) | Só 1 parcela é gravada | Gerar N transactions com vencimentos sequenciais |

## Correção proposta

### 1) Geração automática de parcelas em `Lançamentos` (parcelamento sem cartão)

**Arquivo:** `src/components/lancamentos/TransactionForm.tsx`
- Reformular os campos: substituir "Parcela Nº / Total Parcelas" por um único toggle **"Parcelar?"** + input **"Número de parcelas"** (default 1).
- Quando `parcelas > 1`: o valor digitado é o **valor total**, dividido igualmente entre as parcelas (com ajuste de centavos na última).
- Adicionar input opcional **"Periodicidade"** (mensal — default).

**Arquivo:** `src/hooks/useTransactions.ts`
- Estender o `create` para aceitar `installments_count` e, quando > 1, gerar **N inserts** em uma única chamada `.insert([...])`:
  - `installment_number = 1..N`, `installment_total = N`
  - `description` recebe sufixo `(i/N)`
  - `due_date` e `competence_date` somam `i-1` meses (preservando o dia, com fallback para último dia válido — usar o helper já existente em `useCardPurchases`)
  - `amount` = total/N (última parcela ajusta resíduo de arredondamento)
  - `status = 'planned'` em todas (nunca auto-paid)
  - `payment_date = null`

### 2) Bloqueio inteligente para evitar duplicidade com cartão

No `TransactionForm`, se o usuário selecionar um **Cartão de Crédito** (campo `center_cost`) **e** marcar `parcelas > 1`, exibir aviso e desabilitar o submit, sugerindo usar a tela **Compras no Cartão** (link direto). Motivo: parcelamento de cartão tem regras de fechamento/vencimento próprias que `transactions` não modela.

### 3) Visualização

Como a tela de Lançamentos já consolida `transactions` (mem://features/unified-transactions-view), as N parcelas aparecerão automaticamente quando o filtro de mês incluir cada vencimento. Sem mudança em queries.

### 4) Edição/exclusão de parcelas geradas

- **Excluir**: oferecer no `DeleteDialog` opção "Excluir só esta" / "Excluir todas as parcelas futuras" (agrupando por `description` base + `payee` + `installment_total`). Implementação simples via filtro `installment_total > 1` + match por descrição-base.
- **Editar**: edição segue individual (cada parcela é independente), igual hoje.

### Resposta direta à sua pergunta

> "Isto deve ser feito em recorrências?"

**Não.** Recorrências = pagamentos fixos sem fim (aluguel, assinaturas). Parcelamento finito é função de Lançamentos. Para **cartão de crédito**, use **Compras no Cartão** (já funciona). Para **outros parcelamentos** (financiamento, boleto), vamos corrigir o Lançamentos para gerar as N parcelas.

### Arquivos alterados

1. `src/components/lancamentos/TransactionForm.tsx` — UI de parcelamento + bloqueio quando há cartão
2. `src/hooks/useTransactions.ts` — geração de N inserts com datas sequenciais
3. `src/components/configuracoes/DeleteDialog.tsx` — opção "excluir todas as parcelas" (opcional, posso fazer em segunda fase)

### Riscos
| Risco | Mitigação |
|---|---|
| Edição de uma parcela "quebrar" o grupo | Cada parcela é independente; aviso sutil no rodapé do form ao editar parcela N de M |
| Usuário esperar parcelar no cartão pela tela de Lançamentos | Mensagem clara redirecionando para Compras no Cartão |
| Resíduo de centavos na divisão | Última parcela absorve diferença |

