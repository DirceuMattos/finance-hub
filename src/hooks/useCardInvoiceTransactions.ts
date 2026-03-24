import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { CARD_INVOICE_CENTER_COSTS, CENTER_COST_CARD_MAP } from "@/lib/cardInvoiceRules";

interface CardInvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  competence_date: string;
  due_date: string | null;
  status: string;
  center_cost: string;
  card_name: string;
}

export interface CardInvoiceProjection {
  card_name: string;
  billing_month: string;
  due_date: string | null;
  total_amount: number;
  invoices_count: number;
  status: string;
}

function useCardInvoiceTransactionsQuery() {
  return useQuery({
    queryKey: ["card_invoice_transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, competence_date, due_date, status, center_cost")
        .order("competence_date", { ascending: false });
      if (error) throw error;

      return (data || [])
        .filter((t: any) => {
          return t.center_cost && CARD_INVOICE_CENTER_COSTS.includes(t.center_cost);
        })
        .map((t: any): CardInvoiceTransaction => ({
          id: t.id,
          description: t.description,
          amount: Math.abs(t.amount),
          competence_date: t.competence_date,
          due_date: t.due_date,
          status: t.status,
          center_cost: t.center_cost,
          card_name: CENTER_COST_CARD_MAP[t.center_cost] || t.center_cost,
        }));
    },
  });
}

/** Total faturado por cartão (para barras de progresso) — soma apenas faturas com status planned */
export function useCardInvoicesByCard() {
  const { data: invoices = [], ...rest } = useCardInvoiceTransactionsQuery();

  const byCard = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((i) => i.status === "planned")
      .forEach((i) => {
        map.set(i.card_name, (map.get(i.card_name) || 0) + i.amount);
      });
    return map;
  }, [invoices]);

  return { byCard, ...rest };
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
