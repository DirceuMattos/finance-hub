

## Revisão do Pacote de Ajustes — Status e Plano de Implementação

### Itens já implementados (sem ação necessária)

| # | Item | Status |
|---|------|--------|
| 1.4 | Label "Competência" → "Mês do Evento" | Implementado |
| 1.7 | Coluna entidade: manter só badge | Implementado |
| 1.6 | Font menor na listagem | Implementado (classes `text-xs` aplicadas) |
| 3 | Patrimônio e Investimentos: CRUD + gráfico | Implementado |
| 6 | Módulo Alertas | Implementado |
| 7 | Módulo Relatórios | Implementado |
| 5.1 | Saldo aceitar negativos | Já funciona (input sem `min=0`) |

### Itens pendentes a implementar

| # | Item | Tipo |
|---|------|------|
| 1.1 | Agilidade de lançamento (repetir último) | Frontend |
| 1.2 | Campo parcela (`installment_number`/`installment_total`) | **Backend + Frontend** |
| 1.5 | Nova categoria inline no formulário | Frontend |
| 1.8 | Integração cartão via `card_purchases`/`card_installments` | Frontend |
| 2 | Módulo Recorrências completo | **Backend + Frontend** (usar tabela `recurrences`) |
| 4.1 | Cartões: filtro mês/ano nos cards | Frontend |
| 4.2 | Cartões: revisão dos valores exibidos | Frontend |
| 5.2 | Saldo atual: modelo híbrido (opening_balance + derivado) | Frontend (tooltip + label) |
| 5.3 | Faturas projetadas: incluir passadas | Frontend |

---

### Plano de implementação

**Sprint 1 — Lançamentos: agilidade + parcela + categoria inline**

1. **Repetir último lançamento** (`TransactionForm.tsx`, `Lancamentos.tsx`)
   - Botão "Repetir último" ao lado do "Novo"
   - Ao clicar, abre formulário preenchido com dados do último lançamento salvo (armazenado em `useRef` ou state local)
   - Todos os campos editáveis antes de salvar

2. **Campo parcela** — requer migração
   - Adicionar colunas `installment_number` (int, default 1) e `installment_total` (int, default 1) em `transactions`
   - Exibir no formulário como "Parcela X de Y" (dois inputs lado a lado)
   - Na listagem, exibir badge "1/1" ou "3/12"
   - Não usar parsing de `notes`

3. **Categoria inline** (`TransactionForm.tsx`)
   - No select de categorias, adicionar opção "+ Nova categoria"
   - Ao clicar, exibir mini-formulário (input nome + botão salvar) inline
   - Usar `useCategories().create` existente
   - Após criação, selecionar automaticamente a nova categoria

**Sprint 2 — Recorrências**

- Inspecionar schema da tabela `recurrences` existente
- Criar hook `useRecurrences` com CRUD
- Implementar formulário com frequência mensal/anual
- Listagem com DataTable + ações editar/excluir
- Migrar visualmente lançamentos com "Parcela XX/XX" em notes como sugestão

**Sprint 3 — Cartões: filtro mês/ano + revisão valores**

- `Cartoes.tsx`: adicionar select mês/ano (default: mês vigente)
- Filtrar dados dos cards de resumo pelo mês selecionado
- Recalcular uso do limite com base em `card_purchases` + `card_installments` do mês, não total acumulado
- Priorizar `card_purchases`/`card_installments` sobre `center_cost`

**Sprint 4 — Configurações e Faturas**

- `AccountForm.tsx`: adicionar tooltip "Saldo calculado automaticamente" no campo `current_balance`, tornar read-only com label explicativo
- `FaturasProjetadas.tsx`: adicionar toggle "Incluir faturas passadas" — remover filtro `>= currentMonth` quando ativo

---

### Alterações de banco necessárias

1. **Migração `transactions`**: `ALTER TABLE transactions ADD COLUMN installment_number int DEFAULT 1, ADD COLUMN installment_total int DEFAULT 1;`
2. **Tabela `recurrences`**: verificar schema existente antes de implementar (sem criar tabela nova)

### O que NÃO será feito
- Zero alteração de arquitetura
- Zero lógica de negócio duplicada
- Nenhuma tabela nova (recurrences já existe)
- Nenhum dado simulado

