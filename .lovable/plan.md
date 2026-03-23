

## Plano: Separação Pessoal x Empresarial na Interface

### Contexto
A tabela `financial_entities` possui `entity_type` (personal/business). Contas e cartões já possuem `financial_entity_id`. Transactions e card_purchases também. As views de fluxo mensal já existem separadas (consolidated/personal/business). O plano aplica essa separação como filtro visual nas telas principais.

### Alterações

**1. Dashboard — Filtro por visão (Consolidado/Pessoal/Empresarial)**

- Adicionar `Tabs` no topo: Consolidado, Pessoal, Empresarial
- No hook `useDashboardData`, receber parâmetro `view: "consolidated" | "personal" | "business"`
- Quando `view !== "consolidated"`:
  - Filtrar contas pelo `financial_entity_id` de entidades do tipo correspondente
  - Filtrar transactions pela entidade
  - Usar a view de cashflow correta (`vw_monthly_cashflow_personal` ou `vw_monthly_cashflow_business`)
  - Filtrar card_installments por cartões vinculados à entidade
- Buscar entidades no hook e criar mapa `entity_type → entity_ids[]` para filtrar

**2. Lançamentos — Filtro por entidade e badge visual**

- Já possui filtro por entidade (funcional). Melhorias:
  - Na tabela, adicionar badge visual "Pessoal" ou "Empresarial" baseado no `entity_type` da entidade vinculada
  - No filtro de entidade, agrupar opções: mostrar "— Pessoais —" e "— Empresariais —" como separadores no Select
  - No formulário, ao selecionar conta, preencher automaticamente a entidade financeira baseada no `financial_entity_id` da conta

**3. Configurações — Sem grandes mudanças**

- Já funcional. Adicionar apenas:
  - Na tab de Contas: coluna mostrando "Pessoal"/"Empresarial" baseado na entidade vinculada
  - Na tab de Cartões: idem

**4. Compras no Cartão — Filtro por entidade + badge**

- Adicionar filtro por entidade no FilterBar
- Na tabela, exibir badge "Pessoal"/"Empresarial" baseado na entidade da compra
- No formulário, ao selecionar cartão, sugerir a entidade automaticamente (cartão já possui `financial_entity_id`)

**5. Cartões — Agrupar por entidade**

- Adicionar Tabs (Todos/Pessoal/Empresarial) para filtrar cards por `entity_type` da entidade vinculada

**6. Fluxo Mensal — Já implementado**

- Já possui alternância consolidated/personal/business usando as views corretas. Nenhuma alteração necessária.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/hooks/useDashboardData.ts` | Receber `view`, filtrar por entidade, usar view correta |
| `src/pages/Dashboard.tsx` | Adicionar Tabs de visão |
| `src/pages/Lancamentos.tsx` | Badge pessoal/empresarial, auto-fill entidade ao selecionar conta |
| `src/components/lancamentos/TransactionForm.tsx` | Auto-preencher entidade ao selecionar conta |
| `src/components/configuracoes/AccountsTab.tsx` | Coluna pessoal/empresarial |
| `src/components/configuracoes/CardsTab.tsx` | Coluna pessoal/empresarial |
| `src/pages/Cartoes.tsx` | Tabs por tipo de entidade |
| `src/pages/ComprasCartao.tsx` | Filtro por entidade, badge, auto-fill no form |
| `src/components/cartoes/CardPurchaseForm.tsx` | Auto-preencher entidade ao selecionar cartão |

### Nenhuma tabela criada ou alterada

