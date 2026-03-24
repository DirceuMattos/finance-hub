

## Plano: Separação Pessoal / Empresa / Consolidado em todas as telas

### Estado atual

| Tela | Separação por entidade | Status |
|---|---|---|
| **Dashboard** | ✅ Tabs Consolidado/Pessoal/Empresarial + views corretas | OK |
| **Fluxo Mensal** | ✅ Tabs Consolidado/Pessoal/Empresarial + views corretas | OK |
| **Lançamentos** | ⚠️ Filtro de entidade existe, mas não há visual de destaque da visão ativa | Ajustar |
| **Cartões** | ⚠️ Usa "Todos/Pessoal/Empresarial" mas com valor "all" em vez de "consolidated" — inconsistente | Ajustar |
| **TransactionForm** | ✅ Auto-fill entidade ao selecionar conta | OK |

### Alterações necessárias

**1. `src/pages/Lancamentos.tsx`**

- **Adicionar destaque visual** da entidade ativa: quando `filterEntity` = `all_personal` ou `all_business`, mostrar badge/banner abaixo dos filtros indicando "Visualizando: Pessoal" ou "Visualizando: Empresa"
- **Filtro de conta contextual**: quando entidade selecionada é `all_personal` ou `all_business`, filtrar contas exibidas no select de conta para mostrar apenas contas da entidade correspondente
- **Filtro de categoria contextual**: quando entidade selecionada é `all_personal` ou `all_business`, nenhuma alteração (categorias são globais)

**2. `src/pages/Cartoes.tsx`**

- **Renomear tab "Todos" para "Consolidado"** para consistência com Dashboard e Fluxo Mensal
- **Adicionar destaque visual** da visão ativa: badge ou descrição abaixo do título indicando qual filtro está aplicado
- **Tipo interno**: manter `FilterView = "all" | "personal" | "business"` (o valor "all" funciona como consolidado neste contexto, pois mostra todos os cartões)

**3. Visual de destaque (ambas telas)**

Padrão: um texto pequeno abaixo do PageHeader ou nas tabs mostrando a visão ativa, como já existe no Dashboard (`description={Visão ${viewLabel} das suas finanças}`).

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/pages/Lancamentos.tsx` | Destaque visual da entidade ativa, contas filtradas por tipo de entidade |
| `src/pages/Cartoes.tsx` | Renomear "Todos" → "Consolidado", destaque visual da visão ativa |

Sem alteração no banco. Sem lógica nova. Apenas ajustes de UI para consistência.

