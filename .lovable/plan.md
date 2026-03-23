

## Plano: Filtro dedicado para Faturas de Cartao nos Lancamentos

### Situacao Atual

A maioria dos requisitos **ja esta implementada**:
- Badge "Fatura" com icone CreditCard na descricao ✓
- Badge do cartao associado (BRA Pessoal / Nu Infotkt) na categoria ✓
- Status temporal calculado (paid/pending baseado no cutoff 2026-02-25) ✓
- Registros mantidos como despesas ✓
- Badge Pessoal/Empresa na coluna de entidade ✓
- Entidades agrupadas no filtro (Pessoais / Empresariais) ✓

### Unico ajuste necessario

Adicionar um **filtro especifico para faturas de cartao** no FilterBar. Atualmente o filtro de tipo so tem Receita/Despesa/Transferencia. Adicionar uma opcao "Fatura de Cartao" que filtra apenas lancamentos cuja categoria seja uma das `CARD_INVOICE_CATEGORIES`.

### Implementacao

**Arquivo: `src/pages/Lancamentos.tsx`**

1. Adicionar estado `filterCardInvoice` (all / card_invoice / non_card_invoice)
2. No `filtered` useMemo, quando `filterCardInvoice === "card_invoice"`, manter apenas registros onde `isCardInvoice(t.categories?.name)` seja true
3. Adicionar Select no FilterBar com opcoes: "Todos", "Faturas de Cartao", "Outros lancamentos"

| Arquivo | Alteracao |
|---|---|
| `src/pages/Lancamentos.tsx` | Novo filtro "Fatura de Cartao" no FilterBar |

Sem alteracao no banco. Sem novas tabelas.

