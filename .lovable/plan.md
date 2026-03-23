

## Plano: Estado vazio elegante no módulo de Cartões

### Alterações

**1. Compras no Cartão (`src/pages/ComprasCartao.tsx`)**
- Alterar `emptyMessage` do DataTable para texto informativo: "Nenhuma compra parcelada registrada. Utilize o botão 'Nova' para cadastrar compras no cartão. As parcelas serão geradas automaticamente."

**2. Faturas Projetadas (`src/pages/FaturasProjetadas.tsx`)**
- Alterar `emptyMessage` do DataTable para: "Nenhuma fatura projetada disponível. As faturas são geradas automaticamente a partir de compras parceladas registradas em Compras no Cartão."

**3. Cartões (`src/pages/Cartoes.tsx`)**
- A nota informativa sobre dados de uso já existe (linha 110-112). Manter como está — já cumpre o requisito.

Nenhuma nova tabela. Nenhuma alteração no banco. Apenas textos de estado vazio mais informativos.

| Arquivo | Alteração |
|---|---|
| `src/pages/ComprasCartao.tsx` | Mensagem vazia informativa |
| `src/pages/FaturasProjetadas.tsx` | Mensagem vazia informativa |

