import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
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
    total_amount: number;
    installment_amount: number;
    notes: string | null;
    category_id: string | null;
    status: string;
    first_billing_month: string;
    cards?: { name: string };
    categories?: { name: string } | null;
    financial_entities?: { name: string; entity_type?: string };
  };
};

function getMonthRange(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endMonth = m === 12 ? 1 : m + 1;
  const endYear = m === 12 ? y + 1 : y;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
}

export function useCardInstallmentStatusUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await (supabase as any)
        .from("card_installments")
        .update({ status })
        .eq("id", id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Nenhum registro foi atualizado. Verifique as permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card_installments"] });
      queryClient.invalidateQueries({ queryKey: ["card_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["card_billing_projection"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_monthly_flow_view"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_account_balances_split"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_expenses_category"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_cashflow_chart"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_patrimony"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_investments"] });
      toast.success("Parcela atualizada");
    },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });
}

export function useCardInstallments(filterMonth?: string) {
  return useQuery({
    queryKey: ["card_installments", filterMonth],
    queryFn: async () => {
      let query = (supabase as any)
        .from("card_installments")
        .select("*, card_purchases(description, card_id, purchase_date, payee, installments_count, financial_entity_id, total_amount, installment_amount, notes, category_id, status, first_billing_month, cards(name), categories(name), financial_entities(name, entity_type))")
        .order("due_date", { ascending: true })
        .order("installment_number");

      // Server-side filter by billing_month (financial competence)
      if (filterMonth && filterMonth !== "all") {
        const { start, end } = getMonthRange(filterMonth);
        query = query.filter("billing_month", "gte", start).filter("billing_month", "lt", end);
      } else {
        // No month filter: limit to avoid truncation
        query = query.limit(5000);
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
        const { data: installments, error: fallbackError } = await (supabase as any)
          .from("card_installments")
          .select("*, card_purchases(card_id, cards(name, due_day))")
          .in("status", ["pending", "open"])
          .order("billing_month")
          .limit(5000);
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
