

## Plano: Análise de IA na Previsão de Fechamento

### Visão geral

Adicionar um bloco de análise gerada por IA dentro do card "Previsão de Fechamento do Mês", com um botão "Gerar Análise". A IA receberá os dados financeiros do mês atual e retornará um parecer sobre o panorama de fechamento + cuidados preditivos para o próximo mês.

A `LOVABLE_API_KEY` já está configurada — será usado o Lovable AI (modelo `google/gemini-3-flash-preview`).

### Arquivos a criar

| Arquivo | Descrição |
|---|---|
| `supabase/functions/ai-financial-analysis/index.ts` | Edge function que recebe os dados financeiros, monta o prompt e chama o Lovable AI Gateway |

### Arquivos a alterar

| Arquivo | Descrição |
|---|---|
| `src/pages/Dashboard.tsx` | Adicionar botão "Gerar Análise IA" e área de exibição do resultado dentro do card de Previsão de Fechamento |

### Edge Function `ai-financial-analysis`

- Recebe via POST: `forecast` (income_paid, income_planned, expense_paid, expense_planned, projected_balance, projected_card_amount, potential_containment), `riskLevel`, `balance`, `patrimonyTotal`, `investmentTotal`
- Valida input com Zod
- Monta prompt em português com system message de consultor financeiro
- Chama `https://ai.gateway.lovable.dev/v1/chat/completions` (sem streaming, resposta completa)
- Retorna `{ analysis: string }` com o texto em markdown

**Prompt (system):**
> "Você é um consultor financeiro pessoal. Analise os dados do mês e forneça: 1) Um parecer de 2-3 frases sobre o panorama de fechamento; 2) 2-3 cuidados/recomendações breves para o próximo mês. Seja direto, objetivo e use linguagem acessível."

### Dashboard — UI

- Botão com ícone de Sparkles: "Gerar Análise IA" posicionado abaixo dos valores no card de Previsão de Fechamento
- Estado: idle → loading (spinner) → exibindo resultado
- Resultado renderizado com `react-markdown` em um bloco com fundo sutil
- Botão "Atualizar" para regenerar
- Análise não é persistida — gerada sob demanda

### Fluxo

```text
Usuário clica "Gerar Análise IA"
  → POST /functions/v1/ai-financial-analysis { dados do mês }
  → Edge function monta prompt → chama Lovable AI Gateway
  → Retorna análise em texto
  → Dashboard renderiza markdown no card
```

### Dependências

- Instalar `react-markdown` no frontend para renderização

