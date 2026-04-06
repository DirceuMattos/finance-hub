

## Plano: Exibir Teto Gerencial e Uso no Mês Vigente nos Cards de Cartões

### O que muda

Na tela de Cartões (`src/pages/Cartoes.tsx`), cada card de cartão passará a:

1. **Mostrar "Teto Gerencial" como campo principal** no lugar de "Limite" — o valor exibido será `managerial_limit` (se definido) ou `credit_limit` como fallback
2. **Exibir o uso no mês vigente** — valor já utilizado no mês atual baseado nos dados de `byCard`
3. **Barra de progresso principal baseada no teto gerencial** — a barra principal passa a comparar uso vs teto gerencial, não mais vs limite de crédito
4. O limite de crédito real fica como informação secundária menor

### Alterações técnicas

**Arquivo: `src/pages/Cartoes.tsx`**

- Grid de informações (linhas 129-146): trocar "Limite" por "Teto Gerencial" como primeiro campo, e substituir o segundo campo por "Usado no Mês" mostrando `usedAmount`
- Barra de progresso principal (linhas 179-184): mudar para comparar `usedAmount` vs `managerialLimit`
- Remover a barra de progresso condicional separada do teto gerencial (linhas 186-194) — agora a principal já usa o teto
- Adicionar linha discreta mostrando o limite real do cartão como info secundária

