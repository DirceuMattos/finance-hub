

## Plano: Ajustes no Módulo Compras no Cartão e Lançamentos

### Resumo das 5 solicitações

1. Mostrar data de compra + data de vencimento; filtro por mês usa vencimento
2. Corrigir status "Aberta" para compras já vencidas (ex: 25/03/2026)
3. Expandir parcelas na lista — cada parcela aparece como linha separada
4. Exibir parcelas de cartão na tela de Lançamentos (somente leitura)
5. Seleção em lote para edição/manutenção de múltiplos lançamentos

---

### Etapa 1 — Explodir parcelas na lista de Compras no Cartão

**Arquivo:** `src/pages/ComprasCartao.tsx`

Em vez de exibir uma linha por compra, o módulo passará a exibir **uma linha por parcela** (usando dados de `card_installments`). Cada linha mostrará:

- **Data Compra** — `purchase_date` da compra original
- **Vencimento** — `due_date` da parcela (campo da `card_installments`)
- **Descrição** — descrição da compra
- **Parcela** — ex: "2/6"
- **Valor Parcela** — `amount` da parcela
- **Status** — da parcela individual

O hook `useCardInstallments` será usado para buscar as parcelas com join em `card_purchases`. A filtragem por mês usará o `due_date` (vencimento) da parcela.

Quando o filtro for "Todos os meses", todas as parcelas de todas as compras serão exibidas, permitindo ver a evolução completa.

### Etapa 2 — Corrigir status de parcelas vencidas

**Arquivo:** `src/pages/ComprasCartao.tsx` (lógica de exibição)

Parcelas com `due_date` anterior à data atual e status "open"/"pending" serão exibidas com status visual **"Vencida"** (badge em vermelho/warning). Opcionalmente, uma atualização em lote no banco pode ser feita via migração/trigger para marcar automaticamente parcelas vencidas como "overdue" ou "closed".

A abordagem mais segura: no frontend, derivar o status visual comparando `due_date < hoje` + `status !== 'paid'/'closed'`.

### Etapa 3 — Colunas ajustadas na tabela

**Arquivo:** `src/pages/ComprasCartao.tsx`

Colunas da nova tabela (por parcela):
| Data Compra | Vencimento | Descrição | Favorecido | Cartão | Categoria | Parcela | Valor | Status | Ações |

### Etapa 4 — Exibir parcelas de cartão em Lançamentos

**Arquivo:** `src/pages/Lancamentos.tsx`

- Buscar `card_installments` (com join em `card_purchases`) no mesmo componente
- Transformar cada parcela em um objeto compatível com a interface `Transaction` (campos mapeados: description, amount, due_date, competence_date, status, etc.)
- Concatenar com as transações regulares na lista `filtered`
- Marcar com badge "Cartão" e **desabilitar ações de edição/exclusão** (somente leitura)
- Adicionar filtro para mostrar/ocultar lançamentos de cartão

### Etapa 5 — Seleção e edição em lote

**Arquivos:** `src/components/shared/DataTable.tsx`, `src/pages/Lancamentos.tsx`, `src/pages/ComprasCartao.tsx`

- Adicionar coluna de **checkbox** no `DataTable` (prop opcional `selectable`)
- Checkbox no header para selecionar/desselecionar todos
- Estado `selectedIds` gerenciado no componente pai
- Barra de ações em lote aparece quando há seleção: "Marcar como Realizado", "Cancelar", "Alterar Categoria", "Excluir"
- As ações em lote chamam mutations existentes em loop ou via batch update

**Componente DataTable** receberá novas props opcionais:
```typescript
selectable?: boolean;
selectedKeys?: Set<string>;
onSelectionChange?: (keys: Set<string>) => void;
rowKey?: (row: T) => string;
```

---

### Arquivos a modificar

| Arquivo | Motivo |
|---------|--------|
| `src/pages/ComprasCartao.tsx` | Explodir parcelas, ajustar colunas, filtro por vencimento, status visual |
| `src/hooks/useCardPurchases.ts` | Ajustar query para trazer installments se necessário |
| `src/pages/Lancamentos.tsx` | Integrar parcelas de cartão (read-only), seleção em lote |
| `src/components/shared/DataTable.tsx` | Suporte a checkbox de seleção |
| `src/types/database.ts` | Tipo auxiliar para parcela expandida (se necessário) |

### Sem alterações no banco de dados

Todas as mudanças são no frontend, usando as tabelas e dados já existentes.

