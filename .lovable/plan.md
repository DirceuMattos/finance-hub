

## Plano: Gerar lançamento de saldo ao baixar com valor menor

### Comportamento desejado
Quando o usuário registra a baixa de um lançamento (receita ou despesa) e o valor realizado for menor que o valor previsto, o sistema deve exibir um diálogo perguntando se deseja gerar um novo lançamento "previsto" com o valor da diferença (saldo). Esse novo lançamento herda os mesmos dados do original (descrição, categoria, entidade, conta, tipo, etc.).

### Implementação

**1. Alterar `PaymentDialog.tsx`**
- Adicionar um estado interno para controlar um "passo 2" (confirmação de saldo)
- Após o clique em "Confirmar Baixa", verificar se `valorRealizado < valorPrevisto`
- Se sim, mostrar um sub-diálogo/alerta perguntando: "O valor realizado é menor que o previsto. Deseja gerar um novo lançamento previsto com o saldo de R$ X?"
- Se o usuário confirmar, chamar um novo callback `onCreateRemainder`
- Se não, apenas confirmar a baixa normalmente

**2. Atualizar a interface `PaymentDialogProps`**
- Adicionar prop `onCreateRemainder: (data: Partial<Transaction>) => void` para que o componente pai crie o lançamento de saldo

**3. Alterar `Lancamentos.tsx`**
- No uso do `PaymentDialog`, passar o callback `onCreateRemainder` que chama `create.mutate` com os dados do lançamento original, substituindo o valor pelo saldo e status "planned"

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/lancamentos/PaymentDialog.tsx` | Adicionar lógica de detecção de saldo e diálogo de confirmação; nova prop `onCreateRemainder` |
| `src/pages/Lancamentos.tsx` | Passar `onCreateRemainder` ao `PaymentDialog`, criando novo lançamento com o saldo |

### Fluxo do usuário
1. Clica em "Registrar Baixa" num lançamento previsto
2. Informa valor realizado menor que o previsto
3. Clica "Confirmar Baixa"
4. Sistema exibe: "O valor realizado (R$ X) é menor que o previsto (R$ Y). Deseja gerar um novo lançamento previsto com o saldo de R$ Z?"
5. Sim → baixa é registrada + novo lançamento criado / Não → apenas baixa registrada

