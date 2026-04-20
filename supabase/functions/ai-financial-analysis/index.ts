import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MAGNITUDE = 1e12;
const ALLOWED_RISK_LEVELS = new Set(["controlled", "attention", "critical"]);

function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > MAX_MAGNITUDE) return null;
  return n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) Autenticação JWT obrigatória
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Configuração do servidor inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Validação rigorosa do payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Payload JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { forecast, riskLevel, balance, patrimonyTotal, investmentTotal } = body ?? {};

    if (!forecast || typeof forecast !== "object" || riskLevel === undefined || balance === undefined) {
      return new Response(JSON.stringify({ error: "Dados financeiros incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof riskLevel !== "string" || !ALLOWED_RISK_LEVELS.has(riskLevel)) {
      return new Response(JSON.stringify({ error: "Nível de risco inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numericFields = {
      balance: safeNumber(balance),
      income_paid: safeNumber(forecast.income_paid),
      income_planned: safeNumber(forecast.income_planned),
      expense_paid: safeNumber(forecast.expense_paid),
      expense_planned: safeNumber(forecast.expense_planned),
      projected_balance: safeNumber(forecast.projected_balance),
      projected_card_amount: safeNumber(forecast.projected_card_amount),
      potential_containment: safeNumber(forecast.potential_containment),
      patrimonyTotal: safeNumber(patrimonyTotal),
      investmentTotal: safeNumber(investmentTotal),
    };

    for (const [key, value] of Object.entries(numericFields)) {
      if (value === null) {
        return new Response(JSON.stringify({ error: `Campo numérico inválido: ${key}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const f = numericFields as Record<string, number>;

    const userPrompt = `Dados financeiros do mês:
- Saldo atual: R$ ${f.balance.toFixed(2)}
- Receitas pagas: R$ ${f.income_paid.toFixed(2)}
- Receitas previstas (pendentes): R$ ${f.income_planned.toFixed(2)}
- Despesas pagas: R$ ${f.expense_paid.toFixed(2)}
- Despesas previstas (pendentes): R$ ${f.expense_planned.toFixed(2)}
- Saldo projetado para fim do mês: R$ ${f.projected_balance.toFixed(2)}
- Comprometimento com cartão de crédito: R$ ${f.projected_card_amount.toFixed(2)}
- Potencial de contenção (despesas cortáveis): R$ ${f.potential_containment.toFixed(2)}
- Nível de risco: ${riskLevel}
- Patrimônio total: R$ ${f.patrimonyTotal.toFixed(2)}
- Total investido: R$ ${f.investmentTotal.toFixed(2)}

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
