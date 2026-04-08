import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CARD_INVOICE_CENTER_COSTS,
  CENTER_COST_CARD_MAP,
  CENTER_COST_ENTITY_MAP,
  CUTOFF_DATE,
} from "@/lib/cardInvoiceRules";

interface CardInvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  competence_date: string;
  due_date: string | null;
  status: string;
  center_cost: string;
  card_name: string;
  entity_type: "personal" | "business" | null;
}

export interface CardInvoiceProjection {
  card_name: string;
  billing_month: string;
  due_date: string | null;
  total_amount: number;
  invoices_count: number;
  status: string;
}

export interface CardInvoiceSummary {
  card_name: string;
  entity_type: "personal" | "business" | null;
  paidTotal: number;
  plannedTotal: number;
  historicalTotal: number;
  projectedTotal: number;
  count: number;
}

function useCardInvoiceTransactionsQuery() {
  return useQuery({
    queryKey: ["card_invoice_transactions"],
    queryFn: async () => {
      // Source 1: transactions by center_cost
      const { data: txData, error: txError } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, competence_date, due_date, status, center_cost")
        .order("competence_date", { ascending: false })
        .limit(5000);
      if (txError) throw txError;

      const fromTransactions: CardInvoiceTransaction[] = (txData || [])
        .filter((t: any) => t.center_cost && CARD_INVOICE_CENTER_COSTS.includes(t.center_cost))
        .map((t: any): CardInvoiceTransaction => ({
          id: t.id,
          description: t.description,
          amount: Math.abs(t.amount),
          competence_date: t.competence_date,
          due_date: t.due_date,
          status: t.status,
          center_cost: t.center_cost,
          card_name: CENTER_COST_CARD_MAP[t.center_cost] || t.center_cost,
          entity_type: CENTER_COST_ENTITY_MAP[t.center_cost] || null,
        }));

      // Source 2: card_installments from card_purchases
      let fromInstallments: CardInvoiceTransaction[] = [];
      try {
        const { data: instData, error: instError } = await (supabase as any)
          .from("card_installments")
          .select("id, billing_month, due_date, amount, status, card_purchases(description, card_id, cards(name), financial_entities(entity_type))")
          .order("billing_month", { ascending: false })
          .limit(5000);

        if (!instError && instData) {
          fromInstallments = (instData as any[]).map((inst): CardInvoiceTransaction => {
            const cardName = inst.card_purchases?.cards?.name || "—";
            const entityRaw = inst.card_purchases?.financial_entities?.entity_type;
            const entityType: "personal" | "business" | null =
              entityRaw === "personal" || entityRaw === "business" ? entityRaw : null;
            const statusMapped = inst.status === "paid" ? "paid" : "planned";

            return {
              id: inst.id,
              description: inst.card_purchases?.description || "",
              amount: Math.abs(inst.amount),
              competence_date: inst.billing_month + "-01",
              due_date: inst.due_date,
              status: statusMapped,
              center_cost: "",
              card_name: cardName,
              entity_type: entityType,
            };
          });
        }
      } catch {
        // card_installments table may not exist — ignore
      }

      // Deduplicate: installment IDs won't collide with transaction IDs (both UUIDs)
      const seenIds = new Set(fromTransactions.map((t) => t.id));
      const unique = fromInstallments.filter((i) => !seenIds.has(i.id));

      return [...fromTransactions, ...unique];
    },
  });
}

/** Total faturado por cartão (para barras de progresso) — filtrado por mês */
export function useCardInvoicesByCard(filterMonth?: string) {
  const { data: invoices = [], ...rest } = useCardInvoiceTransactionsQuery();

  const byCard = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((i) => {
        // Filter by month if provided (compare YYYY-MM from competence_date)
        if (filterMonth && filterMonth !== "all") {
          const invMonth = i.competence_date.substring(0, 7);
          if (invMonth !== filterMonth) return false;
        }
        return true;
      })
      .forEach((i) => {
        map.set(i.card_name, (map.get(i.card_name) || 0) + i.amount);
      });
    return map;
  }, [invoices, filterMonth]);

  return { byCard, ...rest };
}

/** Resumo por cartão: totais histórico/futuro, paid/planned, contagem */
export function useCardInvoiceSummaryByCard() {
  const { data: invoices = [], ...rest } = useCardInvoiceTransactionsQuery();

  const summaries = useMemo(() => {
    const map = new Map<string, CardInvoiceSummary>();

    invoices.forEach((inv) => {
      let summary = map.get(inv.card_name);
      if (!summary) {
        summary = {
          card_name: inv.card_name,
          entity_type: inv.entity_type,
          paidTotal: 0,
          plannedTotal: 0,
          historicalTotal: 0,
          projectedTotal: 0,
          count: 0,
        };
        map.set(inv.card_name, summary);
      }

      summary.count += 1;

      // By DB status
      if (inv.status === "paid") summary.paidTotal += inv.amount;
      if (inv.status === "planned") summary.plannedTotal += inv.amount;

      // By temporal UX rule (without overwriting DB status)
      if (inv.competence_date <= CUTOFF_DATE) {
        summary.historicalTotal += inv.amount;
      } else {
        summary.projectedTotal += inv.amount;
      }
    });

    return Array.from(map.values());
  }, [invoices]);

  return { summaries, ...rest };
}

/** Projeções de fatura agrupadas por mês e cartão */
export function useCardInvoiceProjections() {
  const { data: invoices = [], ...rest } = useCardInvoiceTransactionsQuery();

  const projections = useMemo(() => {
    const grouped = new Map<string, CardInvoiceProjection>();

    invoices.forEach((inv) => {
      const month = inv.competence_date.substring(0, 7);
      const key = `${inv.card_name}_${month}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.total_amount += inv.amount;
        existing.invoices_count += 1;
        if (inv.status === "planned") existing.status = "planned";
      } else {
        grouped.set(key, {
          card_name: inv.card_name,
          billing_month: month,
          due_date: inv.due_date,
          total_amount: inv.amount,
          invoices_count: 1,
          status: inv.status,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.billing_month.localeCompare(b.billing_month) || a.card_name.localeCompare(b.card_name)
    );
  }, [invoices]);

  return { projections, ...rest };
}
