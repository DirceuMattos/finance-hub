

## Plano: Flag de Cartão de Crédito em Lançamentos

### Abordagem

O campo `source_type` já existe na tabela `transactions` (tipo `string | null`). Será usado para marcar lançamentos como movimentação de cartão de crédito, gravando o valor `"card"` quando ativado ou `null` quando não.

Sem alteração no banco. Sem lógica nova. Apenas uso de um campo existente.

### Alterações

**1. `src/components/lancamentos/TransactionForm.tsx`**

- Adicionar campo `source_type` ao schema Zod (string opcional, nullable)
- Adicionar **Checkbox/Switch** no formulário com label "Movimentação de Cartão de Crédito"
- No `handleSubmit`, gravar `source_type: "card"` quando ativado, `null` quando não
- No `useEffect` de edição, preencher o checkbox com base em `transaction.source_type === "card"`
- O valor persiste no banco, aplicando-se automaticamente a lançamentos futuros quando editados

**2. `src/pages/Lancamentos.tsx`**

- Na coluna "Descrição", usar `r.source_type === "card"` como critério principal para exibir o badge de cartão (substituindo a lógica atual baseada em `center_cost` e `category_name`)
- No filtro "Fatura", usar `r.source_type === "card"` como critério de filtragem
- Manter compatibilidade: lançamentos antigos sem `source_type` mas com `center_cost`/`category` de cartão continuam sendo reconhecidos (fallback)

### Resultado

- Formulário com switch "Cartão de Crédito" que grava `source_type = "card"` no banco
- Tabela exibe badge de cartão baseado no campo `source_type`
- Filtro funciona com o campo `source_type`
- Valor persiste entre sessões (está no banco)

| Arquivo | O que muda |
|---|---|
| `src/components/lancamentos/TransactionForm.tsx` | Adicionar switch para `source_type` |
| `src/pages/Lancamentos.tsx` | Usar `source_type` para badge e filtro de cartão |

