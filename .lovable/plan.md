

## Plano Final — Pacote de Evolução Finance Hub (Revisado)

### Classificação por tipo

| # | Item | Tipo | Backend? |
|---|------|------|----------|
| 1.1 | Agilidade de lançamento (reaproveitar último) | Frontend | Não |
| 1.2 | Campo de parcela (installment_number/installment_total) | **Backend + Frontend** | **Sim** — adicionar 2 colunas em `transactions` |
| 1.3 | Renomear "Competência" → "Mês do Evento" | Frontend | Não |
| 1.4 | Nova categoria inline no lançamento | Frontend | Não — `useCategories.create` existe |
| 1.5 | Melhoria visual da tabela de lançamentos | Frontend | Não |
| 1.6 | Coluna entidade: remover texto, manter apenas badge | Frontend | Não |
| 1.7 | Integração cartão via card_purchases/card_installments | Frontend | Não — priorizar leitura de `card_purchases` + `card_installments` |
| 2.1 | Ativação módulo Recorrências | **Backend + Frontend** | **Sim** — usar tabela existente `recurrences`, evoluir se necessário |
| 2.2 | Tipos de recorrência (mensal/anual) | Backend + Frontend | Depende do schema atual de `recurrences` |
| 2.3 | Migração lógica de parcelados | Frontend (análise) | Não — apenas identificação |
| 2.4 | Baixa múltipla de fatura de cartão | Frontend | Não |
| 3.1 | CRUD Patrimônio e Investimentos | Frontend | Não — tabelas e hooks já existem |
| 3.2 | Gráfico de linha no Dashboard (investimentos) | Frontend | Não |
| 3.3 | Verificar histórico 6 meses | Frontend | Não |
| 4.1 | Revisão valores cartões | Frontend | Não |
| 4.2 | Filtro mês/ano no módulo Cartões | Frontend | Não |
| 5.1 | Saldo atual aceitar negativos | Frontend | Não — verificar input visual |
| 5.2 | Regra de saldo: modelo híbrido | **Backend + Frontend** | **Sim** — opening_balance manual, current_balance derivado |
| 5.3 | Faturas projetadas: incluir passadas | Frontend | Não |
| 6 | Módulo Alertas | Frontend | Não — consumir `vw_dashboard_alerts` |
| 7 | Módulo Relatórios (exportação) | Frontend | Não |

---

### Itens que exigem backend/schema

**1.2 — Campo de parcela**: Adicionar `installment_number` (integer nullable) e `installment_total` (integer nullable) à tabela `transactions`. O campo `notes` NÃO será usado como fonte de dados de parcela.

**2.1/2.2 — Recorrências**: Usar tabela existente `recurrences` do banco externo. Primeiro passo: inspecionar o schema atual da tabela para mapear campos e identificar se precisa de evolução (ex: coluna `frequency` para mensal/anual).

**5.2 — Saldo atual híbrido**: `opening_balance` permanece editável manualmente. `current_balance` será derivado no banco (opening_balance + receitas pagas - despesas pagas). Requer function ou view no banco externo — se não puder alterar o banco, o frontend exibirá o cálculo como sugestão sem sobrescrever.

---

### Integração com cartões (1.7) — Abordagem revisada

Priorizar `card_purchases` e `card_installments` como fontes estruturadas. O hook `useCardInvoiceTransactions` será refatorado para:
1. Buscar dados de `card_installments` com join em `card_purchases` → `cards`
2. Usar `center_cost` apenas como fallback para lançamentos legados
3. No módulo Cartões e Faturas Projetadas, alimentar a partir de `card_installments`
4. No formulário de lançamento, substituir o select de `center_cost` por referência a `card_purchases` (via `source_type` / `source_id`) quando a constraint permitir — caso contrário, manter `center_cost` como campo de ligação temporário

---

### Alertas (6) — Abordagem revisada

Consumir exclusivamente `vw_dashboard_alerts` do banco. Zero regra de alerta no frontend. Se a view retornar dados, renderizar. Se estiver vazia, exibir mensagem "Nenhum alerta disponível".

---

### Ordem de execução revisada (Recorrências antes de Patrimônio)

**Sprint 1 — Lançamentos: UX visual**
- 1.3 Renomear "Competência" → "Mês do Evento" em `TransactionForm.tsx` e `Lancamentos.tsx`
- 1.5 Tabela com fonte menor (`text-xs`), colunas mais compactas, ações inline sem scroll
- 1.6 Coluna entidade: remover texto do nome, manter apenas badge Pessoal/Empresa

**Sprint 2 — Lançamentos: funcionalidades**
- 1.1 Botão "Repetir último": armazenar último lançamento salvo em `useState`, pré-preencher form
- 1.2 Campo de parcela: migration para `installment_number` + `installment_total`, exibir "X/Y" na tabela, campos no formulário
- 1.4 Criar categoria inline: botão "+ Nova" no select, abre dialog, grava via `useCategories.create`, recarrega lista

**Sprint 3 — Cartões e Faturas (revisão estrutural)**
- 1.7 Refatorar `useCardInvoiceTransactions` para priorizar `card_installments` → `card_purchases` → `cards`
- 4.1 Revisar cálculos no módulo Cartões com dados de `card_installments`
- 4.2 Seletor mês/ano no módulo Cartões: filtrar `card_installments.billing_month` pelo período
- 5.3 Toggle "Incluir passadas" em Faturas Projetadas (remover filtro `>= currentMonth`)

**Sprint 4 — Recorrências (movido para antes de Patrimônio)**
- 2.1 Inspecionar schema de `recurrences`, criar hook `useRecurrences` com CRUD
- 2.2 Implementar formulário com frequência mensal/anual
- 2.3 Identificar lançamentos com "Parcela XX/XX" em `notes` — exibir como sugestão (sem migração automática)
- 2.4 Baixa múltipla: agrupar por `card_installments.billing_month` + `card_id`, exibir composição, confirmar baixa

**Sprint 5 — Patrimônio e Investimentos**
- 3.1 CRUD: formulários de criação/edição/exclusão em `Patrimonio.tsx` e `Investimentos.tsx`
- 3.2 Gráfico de evolução de investimentos no Dashboard (similar ao patrimônio existente, usando `vw_investment_return_by_class` ou `investment_snapshots`)
- 3.3 Exibir mensagem "Sem histórico suficiente (< 6 meses)" quando aplicável

**Sprint 6 — Configurações**
- 5.1 Verificar que input de saldo aceita negativos visualmente (step, sem min=0)
- 5.2 Modelo híbrido: `opening_balance` editável, `current_balance` com label "calculado" + tooltip explicando derivação. Se possível criar function no banco; senão, calcular no frontend como sugestão read-only

**Sprint 7 — Alertas**
- 6 Criar página `/alertas` + rota + sidebar
- Consumir `vw_dashboard_alerts` — renderizar alertas como cards com severidade
- Zero lógica de negócio no frontend

**Sprint 8 — Relatórios**
- 7 Criar página `/relatorios` com exportação XLSX
- Filtros: mês/ano, conta, status, entidade, categoria
- Módulos: Lançamentos, Recorrências, Cartões, Investimentos, Patrimônio
- Usar dados reais das queries existentes

---

### Resumo

- **15 itens apenas frontend**
- **4 itens exigem backend** (parcela em transactions, recorrências, saldo híbrido, integração cartão)
- Nenhuma lógica de negócio duplicada no frontend
- Supabase externo como fonte única da verdade
- Alertas 100% via `vw_dashboard_alerts`
- Recorrências via tabela `recurrences` existente (não criar nova)

