

## Plano: Ocultar coluna Competência em Lançamentos

A coluna "Competência" exibe apenas o primeiro dia do mês (pois `competence_date` é armazenado como `YYYY-MM-01`), tornando-a redundante quando "Vencimento" já mostra a data real. O filtro de mês continuará funcionando internamente via `competence_date`, sem necessidade de exibi-lo na tabela.

### Alteração

**Arquivo: `src/pages/Lancamentos.tsx`**
- Remover a coluna `competence_date` do array `columns`
- Manter o filtro de mês usando `competence_date` internamente (sem mudança na lógica de filtro)

