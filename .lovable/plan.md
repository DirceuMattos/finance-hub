

## Plano: Corrigir exibição de datas e reduzir fonte da tabela

### Problema 1 — Datas exibidas com mês errado

`new Date("2026-03-01")` cria data em UTC meia-noite. No fuso do Brasil (UTC-3), isso vira 28/02 às 21h. O `format(new Date(d), "dd/MM/yyyy")` usa fuso local e mostra o dia anterior.

**Correção em `src/pages/Lancamentos.tsx`:**
- Trocar `format(new Date(d), "dd/MM/yyyy")` por `format(parseISO(d), "dd/MM/yyyy")` (importar `parseISO` de date-fns)
- `parseISO` cria a data no fuso local sem conversão UTC, resolvendo o problema

### Problema 2 — Fonte menor na tabela (estilo planilha)

**Correção em `src/components/shared/DataTable.tsx`:**
- Adicionar `text-xs` nas `TableCell` e reduzir padding com `py-1.5 px-2`
- Manter `TableHead` como está (já usa `text-xs`)
- Reduzir altura das linhas para visual mais compacto

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/pages/Lancamentos.tsx` | Usar `parseISO` em vez de `new Date()` para formatar datas |
| `src/components/shared/DataTable.tsx` | `text-xs` e padding reduzido nas células |

