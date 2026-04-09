

## Plano: Auto-preenchimento do valor de abertura com o fechamento do mês anterior

### Comportamento desejado
Ao criar um novo registro em Investimentos ou Patrimônio, o campo "Valor Abertura" será preenchido automaticamente com o "Valor Fechamento" do mês anterior para o mesmo item/classe+entidade.

### Lógica de correspondência
- **Investimentos**: mesma `investment_class_id` + `financial_entity_id` no mês anterior
- **Patrimônio**: mesmo `item_name` + `financial_entity_id` no mês anterior

### Implementação

**1. `src/hooks/useInvestments.ts`** — nova função `usePreviousClosingValue`
- Recebe `month`, `investment_class_id`, `financial_entity_id`
- Calcula o mês anterior (ex: 2026-04 → 2026-03)
- Busca no Supabase o `closing_value` do registro correspondente em `investment_snapshots`

**2. `src/components/investimentos/InvestmentForm.tsx`**
- Importar e usar o hook acima
- Observar mudanças nos campos `reference_month`, `investment_class_id` e `financial_entity_id`
- Quando os 3 estiverem preenchidos e for um novo registro (não edição), buscar o valor e preencher `opening_value` automaticamente
- O campo continua editável (o usuário pode sobrescrever)

**3. `src/hooks/usePatrimony.ts`** — nova função `usePreviousPatrimonyClosingValue`
- Recebe `month`, `item_name`, `financial_entity_id`
- Mesma lógica: mês anterior, busca `closing_value` em `patrimony_snapshots`

**4. `src/components/patrimonio/PatrimonyForm.tsx`**
- Mesma abordagem: observar os campos relevantes e preencher `opening_value` automaticamente para novos registros

### Sem alterações no banco de dados
Toda a lógica é no frontend, usando consultas pontuais ao banco existente.

