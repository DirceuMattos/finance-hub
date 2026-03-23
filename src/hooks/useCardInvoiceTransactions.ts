import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { CARD_INVOICE_CATEGORIES, CARD_MAP } from "@/lib/cardInvoiceRules";

interface CardInvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  competence_date: string;
  due_date: string | null;
  status: string;
  category_name: string;
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
        .select("id, description, amount, competence_date, due_date, status, categories(name)")
        .order("competence_date", { ascending: false });
      if (error) throw error;

      return (data || [])
        .filter((t: any) => {
          const catName = t.categories?.name;
          return catName && CARD_INVOICE_CATEGORIES.includes(catName);
        })
        .map((t: any): CardInvoiceTransaction => ({
          id: t.id,
          description: t.description,
          amount: Math.abs(t.amount),
          competence_date: t.competence_date,
          due_date: t.due_date,
          status: t.status,
          category_name: t.categories.name,
          card_name: CARD_MAP[t.categories.name] || t.categories.name,
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
      const month = inv.competence_date.substring(0, 7); // yyyy-MM
      const key = `${inv.card_name}_${month}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.total_amount += inv.amount;
        existing.invoices_count += 1;
        // If any invoice in the month is planned, the group is planned
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
