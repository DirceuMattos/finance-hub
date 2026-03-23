

## Validação do MVP — Estado Atual com Dados Reais

### Telas que existem e exibem dados reais

| Tela | Tabelas/Views usadas | Dados reais? | Separação Pessoal/Empresa |
|---|---|---|---|
| **Dashboard** | `accounts`, `financial_entities`, `transactions`, `card_installments`, `vw_monthly_cashflow_consolidated/personal/business` | Sim — saldo de contas, receitas/despesas por mês, despesas por categoria | Sim — tabs Consolidado/Pessoal/Empresarial |
| **Lançamentos** | `transactions` (join `categories`, `financial_entities`, `accounts`) | Sim — centenas de registros reais visíveis | Sim — badge Pessoal/Empresa, filtro por entidade |
| **Fluxo Mensal** | `vw_monthly_cashflow_consolidated/personal/business` | Sim (se a view retorna dados) | Sim — tabs de visão |
| **Configurações** | `financial_entities`, `accounts`, `cards`, `categories`, `system_parameters` | Sim — dados reais de entidades, contas, cartões, categorias | Sim — badge nas tabs de Contas e Cartões |

### Telas que existem mas podem estar vazias

| Tela | Tabelas/Views | Situação |
|---|---|---|
| **Compras no Cartão** | `card_purchases` (join `cards`, `categories`, `financial_entities`) | Vazia se não há registros em `card_purchases` |
| **Faturas Projetadas** | `vw_card_billing_projection` / `card_installments` | Vazia se não há `card_installments` |
| **Cartões** | `cards` (join `financial_entities`) | Exibe cartões cadastrados, sem dados de uso detalhado |
| **Recorrências** | `recurrences` | Depende de dados na tabela |

### Telas que NÃO existem no app

| Tela solicitada | Situação |
|---|---|
| **Patrimônio** | Não existe página, rota ou componente. O campo `total_portfolio_value` existe na view de cashflow mas não tem tela dedicada. |
| **Investimentos** | Não existe página, rota ou componente. O campo `investment_estimated_return` existe na view de cashflow. Não há tabela `investments` ou `investment_movements` sendo consumida. |

### Limitações atuais do MVP

1. **Patrimônio e Investimentos** — não há telas implementadas. Precisam ser criadas do zero (página, rota, sidebar, hook). Antes de criar, preciso saber quais tabelas/views do banco externo existem para patrimônio e investimentos.

2. **Compras no Cartão e Faturas** — funcionais no código, mas dependem de dados em `card_purchases` e `card_installments`.

3. **Recorrências** — página existe mas pode não estar completa com CRUD funcional.

4. **Contas com saldo zero** — `current_balance` retorna 0.00 em todas as contas. Pode ser que os saldos reais precisem ser atualizados no banco.

### Próximos passos recomendados

Para avançar com Patrimônio e Investimentos, preciso que você informe:
- Quais tabelas ou views existem no banco externo para patrimônio e investimentos?
- Exemplos: `investments`, `investment_positions`, `portfolio_assets`, `vw_portfolio_summary`, etc.

Com essa informação, posso criar as telas correspondentes sem alterar a modelagem.

