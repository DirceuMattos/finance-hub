

## Plano: Ajustar módulo de Lançamentos

### Problemas identificados

1. **Coluna "Entidade"** mostra apenas badge (Pessoal/Empresa), sem o nome da entidade
2. **Colunas de data incompletas** — faltam `competence_date` e `payment_date` na tabela
3. **Referências a "pending"** nas ações (linhas 162, 165) — status inválido
4. **Filtro de entidade** lista entidades individuais mas não tem atalho "Pessoal" / "Empresa" como grupo
5. **Filtro de conta** não filtra por entidade ativa selecionada

### Alterações

**`src/pages/Lancamentos.tsx`**

- **Coluna "Entidade"**: mostrar nome da entidade + badge de tipo (Pessoal/Empresa)
- **Adicionar coluna "Competência"**: exibir `competence_date` formatado como MM/YYYY
- **Adicionar coluna "Pagamento"**: exibir `payment_date` formatado como dd/MM/yyyy ou "—"
- **Remover referências a "pending"**: ações de baixa e cancelamento usam apenas `status === "planned"`
- **Filtro de entidade**: adicionar opções "Todas Pessoais" e "Todas Empresariais" que filtram pelo `entity_type` do join, além das entidades individuais
- **Ordenar colunas**: Vencimento | Competência | Descrição | Tipo | Categoria | Entidade | Conta | Valor | Status | Pagamento | Ações

**Nenhum outro arquivo alterado.** Query do hook já traz `financial_entities(name, entity_type)`, `categories(name)`, `accounts(name)` — dados suficientes.

### Regras respeitadas

- Zero lógica nova — apenas ajuste de exibição e filtros
- Dados vêm do banco via join existente
- Status: planned / paid / cancelled (sem pending)

| Arquivo | O que muda |
|---|---|
| `src/pages/Lancamentos.tsx` | Colunas de data, nome da entidade, remover pending, filtro por tipo de entidade |

