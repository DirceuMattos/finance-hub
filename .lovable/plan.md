

## Plano: Regra Temporal para Lancamentos de Cartao de Credito

### Contexto

Existem transactions no banco com categorias "Cartoes de Credito - Pessoal" e "Cartoes de Credito - Prof." que representam faturas de cartao. O usuario quer aplicar uma regra temporal no frontend:
- `competence_date <= 2026-02-25` → tratado como realizado/historico
- `competence_date >= 2026-02-26` → tratado como previsto/futuro

E associar visualmente:
- "Cartoes de Credito - Pessoal" → cartao "BRA Pessoal"
- "Cartoes de Credito - Prof." → cartao "Nu Infotkt"

### Implementacao

**1. Criar helper de identificacao de lancamento de fatura**

Criar constantes e funcao utilitaria em `src/lib/cardInvoiceRules.ts`:

```text
CARD_INVOICE_CATEGORIES = [
  "Cartões de Crédito - Pessoal",
  "Cartões de Crédito - Prof."
]
CUTOFF_DATE = "2026-02-25"
CARD_MAP = {
  "Cartões de Crédito - Pessoal": "BRA Pessoal",
  "Cartões de Crédito - Prof.": "Nu Infotkt"
}

isCardInvoice(categoryName) → boolean
getCardInvoiceStatus(categoryName, competenceDate) → "paid" | "pending"
getCardInvoiceLabel(categoryName) → string (ex: "BRA Pessoal")
```

**2. Lancamentos (`Lancamentos.tsx`)**

- Na coluna "Descricao", se `isCardInvoice`, adicionar Badge `"Fatura"` com icone de cartao (CreditCard) ao lado
- Na coluna "Status", se `isCardInvoice`, usar o status calculado pela regra temporal em vez do `status` do banco
- Na coluna "Categoria", manter o nome original mas com badge indicando o cartao associado

**3. Dashboard (`useDashboardData.ts`)**

- Sem alteracao na query — os valores ja vem corretos do banco. A regra temporal e apenas visual/classificatoria no frontend.

**4. Fluxo Mensal (`FluxoMensal.tsx`)**

- Sem alteracao — usa views que ja calculam os valores. A regra temporal nao altera os montantes, apenas a classificacao visual.

### Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/lib/cardInvoiceRules.ts` | Novo: constantes e funcoes helper |
| `src/pages/Lancamentos.tsx` | Badge visual "Fatura" + status temporal calculado para lancamentos de cartao |

### Sem alteracao no banco

