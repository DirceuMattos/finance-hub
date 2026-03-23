

## Plano: Ação "Registrar Baixa" em Lançamentos

### Alterações

**1. Novo componente: `src/components/lancamentos/PaymentDialog.tsx`**

Modal simples com:
- Campo "Data efetiva" (DatePicker)
- Campo "Valor realizado" (Input numérico, pré-preenchido com `amount` atual)
- Botões Cancelar / Confirmar

Ao confirmar, chama `update.mutate({ id, status: "paid", payment_date, amount })`.

**2. Arquivo: `src/pages/Lancamentos.tsx`**

- Importar `PaymentDialog` e ícone `CheckCircle`
- Adicionar estado `settling: Transaction | null`
- Na coluna "Ações", adicionar botão "Registrar baixa" (ícone CheckCircle verde) **apenas** quando `r.status === "planned" || r.status === "pending"`
- Ao clicar, abre o `PaymentDialog` com os dados do lançamento
- Ao confirmar, executa `update.mutate` e fecha o modal
- A listagem se atualiza automaticamente via `invalidateQueries`

### Lógica de visibilidade

| Status | Editar | Cancelar | Baixa | Excluir |
|---|---|---|---|---|
| planned/pending | ✓ | ✓ | ✓ | ✓ |
| paid | ✓ | — | — | ✓ |
| cancelled | ✓ | — | — | ✓ |

| Arquivo | Alteração |
|---|---|
| `src/components/lancamentos/PaymentDialog.tsx` | Novo — modal de baixa |
| `src/pages/Lancamentos.tsx` | Botão condicional + estado para abrir modal |

Sem alteração no banco.

