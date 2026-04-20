import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";
import type { CardPurchase } from "@/types/database";

function calcFirstBillingMonth(purchaseDate: string, closingDay: number): string {
  const [y, m, d] = purchaseDate.split("-").map(Number);
  let billingYear = y;
  let billingMonth = m; // 1-indexed
  if (d > closingDay) {
    billingMonth += 1;
    if (billingMonth > 12) {
      billingMonth = 1;
      billingYear += 1;
    }
  }
  return `${billingYear}-${String(billingMonth).padStart(2, "0")}-01`;
}

function calcInstallmentDates(firstBillingMonth: string, dueDay: number, installmentNumber: number) {
  const [y, m] = firstBillingMonth.split("-").map(Number);
  const offsetMonths = installmentNumber - 1;
  let newMonth = m + offsetMonths;
  let newYear = y;
  while (newMonth > 12) { newMonth -= 12; newYear += 1; }
  const billingMonth = `${newYear}-${String(newMonth).padStart(2, "0")}-01`;
  const maxDay = new Date(newYear, newMonth, 0).getDate();
  const actualDueDay = Math.min(dueDay, maxDay);
  const dueDate = `${newYear}-${String(newMonth).padStart(2, "0")}-${String(actualDueDay).padStart(2, "0")}`;
  return { billingMonth, dueDate };
}

const INVALIDATE_KEYS = [
  "card_purchases", "card_installments", "card_billing_projection",
  "accounts", "dashboard_monthly_flow_view", "dashboard_account_balances_split",
  "dashboard_expenses_category", "dashboard_cashflow_chart",
];

export function useCardPurchases() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    INVALIDATE_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const query = useQuery({
    queryKey: ["card_purchases"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("card_purchases")
        .select("*, cards(name), categories(name), financial_entities(name)")
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data as CardPurchase[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<CardPurchase>) => {
      const { cards, categories, financial_entities, ...rest } = item as any;
      const { error } = await (supabase as any).from("card_purchases").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Compra registrada com sucesso"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CardPurchase> & { id: string }) => {
      const { cards, categories, financial_entities, ...rest } = data as any;

      // Fetch the card to get closing_day and due_day
      let cardData: any = null;
      if (rest.card_id) {
        const { data: cd } = await (supabase as any).from("cards").select("closing_day, due_day").eq("id", rest.card_id).single();
        cardData = cd;
      }

      // Recalculate first_billing_month if purchase_date is present
      if (rest.purchase_date && cardData) {
        rest.first_billing_month = calcFirstBillingMonth(rest.purchase_date, cardData.closing_day);
      }

      const { data: updated, error } = await (supabase as any).from("card_purchases").update(rest).eq("id", id).select();
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error("Nenhum registro foi atualizado. Verifique as permissões.");

      const purchase = updated[0];

      // Recalculate all installments: amount, billing_month, due_date
      const { data: installments } = await (supabase as any)
        .from("card_installments")
        .select("id, installment_number")
        .eq("card_purchase_id", id);

      if (installments && installments.length > 0 && cardData) {
        const firstBilling = purchase.first_billing_month;
        const installmentAmount = purchase.installment_amount ?? (purchase.total_amount / purchase.installments_count);

        for (const inst of installments) {
          const { billingMonth, dueDate } = calcInstallmentDates(firstBilling, cardData.due_day, inst.installment_number);
          await (supabase as any)
            .from("card_installments")
            .update({ amount: installmentAmount, billing_month: billingMonth, due_date: dueDate })
            .eq("id", inst.id);
        }
      }
    },
    onSuccess: () => { invalidateAll(); toast.success("Compra atualizada"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("card_purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Compra excluída"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { ...query, create, update, remove };
}
