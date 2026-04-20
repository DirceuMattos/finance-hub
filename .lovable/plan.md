
Objetivo: corrigir os dois bugs em `src/hooks/useDashboardData.ts` sem mexer em banco, alinhando o Dashboard com a lógica já usada no Fluxo Mensal.

### 1. Corrigir a race condition das queries dependentes de entidades
Atualizar as queries que usam `filterIds`, `personalIds` ou `businessIds` para só rodarem depois que `entitiesQuery` terminar.

#### Ajustes diretos
Em `src/hooks/useDashboardData.ts`:

- `monthlyFlow`
  - adicionar `enabled: entitiesQuery.isFetched`
- `accountBalances`
  - trocar `enabled: entities.length > 0` por `enabled: entitiesQuery.isFetched`
- `expensesByCategory`
  - adicionar `enabled: entitiesQuery.isFetched`
- `patrimonyData`
  - adicionar `enabled: entitiesQuery.isFetched`

### 2. Corrigir a dupla subtração de cartão no saldo projetado
Hoje o hook faz:

```ts
const projected_balance = totalIncome - totalExpense - projected_card_amount - card_paid_amount;
```

Isso é incorreto para a previsão, porque:
- `projected_card_amount` já representa apenas parcelas futuras/não pagas
- `card_paid_amount` é apenas segregação analítica e não deve reduzir o saldo projetado do mês

#### Correção
Substituir por:

```ts
const totalExpense = expense_paid + expense_planned;
const projected_balance = totalIncome - totalExpense - projected_card_amount;
```

ou equivalente com a mesma regra.

### 3. Alinhar a lógica com a regra existente do projeto
Manter `card_paid_amount` no retorno da query para análise e depuração, mas sem participar do cálculo do `projected_balance`.

Isso deixa `useDashboardData` consistente com:
- a memória de negócio de cartão (`projected_card_amount` considera apenas não pagos)
- a implementação já existente em `src/hooks/useMonthlyCashflow.ts`

### 4. Validação de consistência no próprio hook
Após a correção, revisar rapidamente os pontos que consomem o resultado dentro do mesmo hook para garantir que nada dependa da lógica antiga:
- `forecast.projected_balance`
- `riskData.closingBalance`
- `riskData.forecastResult`
- mensagem e semáforo (`traffic_light`)

### 5. Verificação funcional esperada
Depois da implementação, o comportamento correto deve ser:

- ao abrir o Dashboard nas visões `Pessoal` e `Empresarial`, a primeira carga já vem filtrada corretamente por entidade
- não há mais um primeiro fetch “consolidado sem querer”
- o saldo projetado sobe para o valor correto quando existirem parcelas de cartão já pagas, porque elas deixam de ser subtraídas duas vezes
- os cards de risco e previsão do mês ficam consistentes com o Fluxo Mensal

### Arquivo a alterar
- `src/hooks/useDashboardData.ts`

### Resultado esperado
- sem race condition na primeira renderização das queries dependentes de entidade
- sem dupla subtração de cartão no cálculo do saldo projetado
- Dashboard consistente com as regras financeiras já definidas no projeto
