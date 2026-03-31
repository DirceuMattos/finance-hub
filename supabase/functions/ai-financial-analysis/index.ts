import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { forecast, riskLevel, balance, patrimonyTotal, investmentTotal } = body;

    if (!forecast || riskLevel === undefined || balance === undefined) {
      return new Response(JSON.stringify({ error: "Dados financeiros incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Dados financeiros do mês:
- Saldo atual: R$ ${balance.toFixed(2)}
- Receitas pagas: R$ ${forecast.income_paid.toFixed(2)}
- Receitas previstas (pendentes): R$ ${forecast.income_planned.toFixed(2)}
- Despesas pagas: R$ ${forecast.expense_paid.toFixed(2)}
- Despesas previstas (pendentes): R$ ${forecast.expense_planned.toFixed(2)}
- Saldo projetado para fim do mês: R$ ${forecast.projected_balance.toFixed(2)}
- Comprometimento com cartão de crédito: R$ ${forecast.projected_card_amount.toFixed(2)}
- Potencial de contenção (despesas cortáveis): R$ ${forecast.potential_containment.toFixed(2)}
- Nível de risco: ${riskLevel}
- Patrimônio total: R$ ${(patrimonyTotal ?? 0).toFixed(2)}
- Total investido: R$ ${(investmentTotal ?? 0).toFixed(2)}

Forneça sua análise conforme as instruções.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é um consultor financeiro pessoal experiente. Analise os dados financeiros do mês fornecidos e responda em português do Brasil com:\n1) Um parecer de 2-3 frases sobre o panorama de fechamento do mês atual.\n2) 2-3 cuidados ou recomendações breves e práticas para o próximo mês.\n\nSeja direto, objetivo e use linguagem acessível. Formate sua resposta em markdown com dois títulos: **Panorama do Mês** e **Cuidados para o Próximo Mês**.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione fundos em Configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao gerar análise" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-financial-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
