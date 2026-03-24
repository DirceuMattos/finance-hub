

## Plano: Módulo de Alertas

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/hooks/useAlerts.ts` | **Criar** — hook que lê `vw_dashboard_alerts` via Supabase, com filtro por entity_type |
| `src/pages/Alertas.tsx` | **Criar** — página com tabs Pessoal/Empresa/Consolidado, renderiza cards de alerta ou mensagem vazia |
| `src/App.tsx` | **Modificar** — adicionar rota `/alertas` |
| `src/components/layout/AppSidebar.tsx` | **Modificar** — adicionar link "Alertas" no grupo "Visão Geral" com ícone `Bell` |

### Detalhes técnicos

**`useAlerts.ts`**
- Query à view `vw_dashboard_alerts` via `supabase` de `@/lib/supabaseClient.ts`
- Aceita parâmetro `viewType: "consolidated" | "personal" | "business"`
- Se `personal` ou `business`, filtra por `entity_type` (assumindo que a view expõe esse campo)
- Se `consolidated`, retorna todos os registros
- Retorna array de alertas; zero lógica de cálculo

**`Alertas.tsx`**
- `AppLayout` + `PageHeader` + `Tabs` (Consolidado / Pessoal / Empresa)
- Cada alerta renderizado como `Card` com:
  - Título e descrição vindos da view
  - Badge de severidade com cor: verde (baixo), amarelo (médio), vermelho (alto)
  - Data de referência formatada (se existir no registro)
- Estado vazio: "Nenhum alerta disponível no momento"
- Loading: skeleton cards

**Sidebar**: Item "Alertas" adicionado ao grupo "Visão Geral", abaixo de Dashboard, com ícone `Bell`.

### O que NÃO será feito
- Zero lógica de alerta no frontend
- Nenhuma tabela ou view criada
- Nenhum recálculo de dados

