

## Plano: Ajuste na tela de Cartões — nota sobre dados históricos

### Situação Atual

Itens 1 a 5 **já estão implementados**:
- Badge "Fatura" + nome do cartão (BRA Pessoal / Nu Infotkt) na descrição e categoria ✓
- Registros mantidos em `transactions` ✓
- Badge Pessoal/Empresa na entidade ✓
- Filtro "Faturas de Cartão" no FilterBar ✓
- Status temporal (paid/pending baseado no cutoff 2026-02-25) ✓
- Dashboard e Fluxo Mensal impactados normalmente via views ✓

### Único ajuste necessário

**Item 6 — Tela de Cartões**: Adicionar uma nota informativa em cada card indicando que os dados atuais de uso representam pagamentos de fatura históricos (vindos de `transactions`), não compras itemizadas (que viriam de `card_purchases`).

### Implementação

**Arquivo: `src/pages/Cartoes.tsx`**

- Na seção de "Uso do Limite" (atualmente fixa em 0), adicionar um texto informativo:
  `"Dados de uso baseados em pagamentos de fatura registrados. Para detalhamento por compra, utilize Compras no Cartão."`
- Manter o layout atual dos cards com limite, teto gerencial, entidade e badges

| Arquivo | Alteração |
|---|---|
| `src/pages/Cartoes.tsx` | Nota informativa sobre origem dos dados em cada card |

Sem alteração no banco.

