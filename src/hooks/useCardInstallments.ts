import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { CardInstallment } from "@/types/database";

export interface BillingProjection {
  card_id: string;
  card_name: string;
  billing_month: string;
  due_date: string;
  total_amount: number;
  installments_count: number;
}

export type InstallmentRow = CardInstallment & {
  card_purchases?: {
    description: string;
    card_id: string;
    purchase_date: string;
    payee: string | null;
    installments_count: number;
    financial_entity_id: string;
    cards?: { name: string };
    categories?: { name: string } | null;
    financial_entities?: { name: string };
  };
};

export function useCardInstallments(cardId?: string, billingMonth?: string) {
  return useQuery({
    queryKey: ["card_installments", cardId, billingMonth],
    queryFn: async () => {
      let query = (supabase as any)
        .from("card_installments")
        .select("*, card_purchases(description, card_id, purchase_date, payee, installments_count, financial_entity_id, cards(name), categories(name), financial_entities(name))")
        .order("billing_month")
        .order("installment_number");
      if (cardId) {
        query = query.eq("card_purchases.card_id", cardId);
      }
      if (billingMonth) {
        query = query.eq("billing_month", billingMonth);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as InstallmentRow[];
    },
  });
}

export function useBillingProjection() {
  return useQuery({
    queryKey: ["card_billing_projection"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_card_billing_projection")
        .select("*")
        .order("billing_month")
        .order("card_name");
      if (error) {
        // View might not exist — fallback to manual aggregation
        const { data: installments, error: fallbackError } = await (supabase as any)
          .from("card_installments")
          .select("*, card_purchases(card_id, cards(name, due_day))")
          .in("status", ["pending", "open"])
          .order("billing_month");
        if (fallbackError) throw fallbackError;

        const grouped = new Map<string, BillingProjection>();
        for (const inst of (installments || [])) {
          const cardName = inst.card_purchases?.cards?.name || "—";
          const cardId = inst.card_purchases?.card_id || "";
          const key = `${cardId}_${inst.billing_month}`;
          const existing = grouped.get(key);
          if (existing) {
            existing.total_amount += inst.amount;
            existing.installments_count += 1;
          } else {
            grouped.set(key, {
              card_id: cardId,
              card_name: cardName,
              billing_month: inst.billing_month,
              due_date: inst.due_date,
              total_amount: inst.amount,
              installments_count: 1,
            });
          }
        }
        return Array.from(grouped.values());
      }
      return data as BillingProjection[];
    },
  });
}
