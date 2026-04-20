
## Plano: Provar a origem do valor exibido e corrigir o caminho responsável

### Objetivo
Eliminar a ambiguidade entre:
1. valor realmente salvo no banco,
2. valor retornado pela API,
3. valor renderizado na tabela de Lançamentos,
4. impacto em Dashboard e saldos.

### Leitura atual do problema
- O caso do INSS precisa ser tratado como **bug funcional até prova em contrário**, porque a interface está induzindo leitura incorreta do histórico.
- Hoje a tela de Lançamentos mistura:
  - dados vindos de `transactions`
  - dados vindos de `card_installments`
  - filtros e ordenação locais
- O fluxo de baixa passa por `PaymentDialog` e `useTransactions.update`.
- A query atual de `useTransactions` busca corretamente linha a linha por `id`, então a suspeita principal não é update em massa no hook, e sim:
  - dado herdado salvo errado no banco, ou
  - caminho de exibição/normalização na tela mascarando o histórico.

### Implementação proposta

#### Passo 1 — Instrumentar a origem do valor exibido na tela de Lançamentos
**Arquivos:**  
- `src/pages/Lancamentos.tsx`
- `src/hooks/useTransactions.ts`

Adicionar uma camada temporária de diagnóstico visual para cada linha de transação comum:
- exibir `id` curto em tooltip ou texto secundário
- exibir um indicador de origem do valor:
  - `valor_raw_db`
  - `payment_date`
  - `updated_at`
- garantir que a tabela renderize exatamente `t.amount` vindo da query, sem transformação intermediária fora do formatter monetário.

Objetivo: separar “valor salvo” de “valor percebido”.

#### Passo 2 — Trazer metadados suficientes da tabela `transactions`
**Arquivo:** `src/hooks/useTransactions.ts`

Ampliar o `select` para incluir explicitamente os campos usados no diagnóstico da linha:
- `id`
- `amount`
- `status`
- `payment_date`
- `created_at`
- `updated_at`
- `source_type`
- `source_id`

Isso permite auditar na própria UI se a linha de fev/2026 e mar/2026 está vindo com 550 do backend ou se a distorção acontece só no render.

#### Passo 3 — Revisar a montagem da visão unificada
**Arquivo:** `src/pages/Lancamentos.tsx`

Auditar e ajustar o mapeamento `txRows` / `cardRows` para evitar qualquer confusão entre:
- `amount` de transação comum
- `amount` de parcela de cartão
- `payment_date` nulo em cartão
- `card_name` e outros campos derivados

Aplicar correção se houver qualquer sobrescrita indireta no objeto `UnifiedRow`.

#### Passo 4 — Bloquear definitivamente qualquer baixa que altere mais do que o necessário
**Arquivo:** `src/hooks/useTransactions.ts`

Restringir o update de baixa a um payload mínimo controlado por whitelist, para que nenhuma chamada futura consiga mandar campos indevidos:
- `status`
- `payment_date`
- `amount`
- campos explicitamente editáveis do formulário

Isso não resolve exibição por si só, mas elimina risco de regressão silenciosa.

#### Passo 5 — Validar o fluxo de baixa no `PaymentDialog`
**Arquivo:** `src/components/lancamentos/PaymentDialog.tsx`

Revisar o submit da baixa para garantir:
- envio apenas do `id` da linha aberta
- uso do valor digitado apenas para aquela transação
- nenhuma propagação para outras linhas
- consistência do campo `amount` no parse do input

Se necessário, substituir o `parseFloat(amount)` por parser monetário único e consistente com o formulário principal.

#### Passo 6 — Corrigir a percepção na UI quando houver histórico com mesmo valor salvo
**Arquivo:** `src/pages/Lancamentos.tsx`

Se a investigação mostrar que fev/2026 e mar/2026 realmente já estão 550 no banco, a tela deve deixar isso explícito para não parecer “valor copiado da baixa de hoje”:
- mostrar `updated_at`/“última alteração”
- opcionalmente destacar registros alterados hoje
- evitar que o usuário conclua que a baixa corrente reescreveu o passado

Isso não muda dado, mas corrige o problema de confiabilidade visual.

### Se o diagnóstico confirmar problema de dados, não só de front
Então o trabalho continua com uma segunda etapa:
- identificar exatamente quais lançamentos históricos foram criados com valor indevido
- corrigir esses registros de forma dirigida
- recalcular saldos depois

Como você apontou corretamente: se o valor correto não aparece, o sistema está errado — seja no banco, seja no front. Este plano fecha os dois lados.

### Arquivos previstos
1. `src/hooks/useTransactions.ts`
2. `src/pages/Lancamentos.tsx`
3. `src/components/lancamentos/PaymentDialog.tsx`

### Resultado esperado
- cada linha da tela passa a refletir inequivocamente o valor vindo do backend;
- a baixa do mês atual não poderá mais parecer reescrever meses anteriores;
- se houver dado histórico salvo errado, ele ficará identificado de forma objetiva para correção posterior;
- Dashboard e saldos passam a poder ser auditados com confiança a partir da mesma origem de dados.

### Validação após implementar
1. Abrir Lançamentos com filtro `Realizado`.
2. Comparar INSS fev/2026, mar/2026 e abr/2026.
3. Registrar uma nova baixa.
4. Confirmar que:
   - apenas a linha aberta muda,
   - os meses anteriores mantêm o valor já salvo,
   - a UI mostra claramente a origem e a última alteração do valor.
