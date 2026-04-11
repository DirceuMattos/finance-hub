import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format } from "date-fns";

export function useRepairInstallments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const currentMonth = format(new Date(), "yyyy-MM") + "-01";

      // Fetch all purchases with card info
      const { data: purchases, error: pErr } = await (supabase as any)
        .from("card_purchases")
        .select("id, installment_amount, total_amount, installments_count, first_billing_month, card_id, purchase_date")
        .limit(5000);
      if (pErr) throw pErr;

      // Fetch all cards for closing_day/due_day lookup
      const { data: allCards } = await (supabase as any).from("cards").select("id, closing_day, due_day");
      const cardMap = new Map((allCards || []).map((c: any) => [c.id, c]));

      let fixed = 0;
      for (const p of (purchases || [])) {
        const card: any = cardMap.get(p.card_id);
        if (!card) continue;

        const correctAmount = p.installment_amount || (p.total_amount / p.installments_count);
        if (!correctAmount || correctAmount <= 0) continue;

        // Recalculate first_billing_month from purchase_date
        let firstBilling = p.first_billing_month;
        if (p.purchase_date && card.closing_day) {
          const [y, m, d] = p.purchase_date.split("-").map(Number);
          let bm = m, by = y;
          if (d > card.closing_day) { bm += 1; if (bm > 12) { bm = 1; by += 1; } }
          const correctFirstBilling = `${by}-${String(bm).padStart(2, "0")}-01`;
          if (firstBilling !== correctFirstBilling) {
            await (supabase as any).from("card_purchases").update({ first_billing_month: correctFirstBilling }).eq("id", p.id);
            firstBilling = correctFirstBilling;
            fixed++;
          }
        }

        // Fix installments
        const { data: insts } = await (supabase as any)
          .from("card_installments")
          .select("id, amount, installment_number, billing_month, due_date")
          .eq("card_purchase_id", p.id);

        for (const inst of (insts || [])) {
          const updates: any = {};

          if (Math.abs(inst.amount - correctAmount) > 0.01) {
            updates.amount = correctAmount;
          }

          // Recalculate billing_month and due_date
          if (firstBilling && card.due_day && inst.installment_number) {
            const [fy, fm] = firstBilling.split("-").map(Number);
            const offset = inst.installment_number - 1;
            let nm = fm + offset, ny = fy;
            while (nm > 12) { nm -= 12; ny += 1; }
            const correctBilling = `${ny}-${String(nm).padStart(2, "0")}-01`;
            const maxDay = new Date(ny, nm, 0).getDate();
            const actualDueDay = Math.min(card.due_day, maxDay);
            const correctDueDate = `${ny}-${String(nm).padStart(2, "0")}-${String(actualDueDay).padStart(2, "0")}`;

            if (inst.billing_month !== correctBilling) updates.billing_month = correctBilling;
            if (inst.due_date !== correctDueDate) updates.due_date = correctDueDate;
          }

          if (Object.keys(updates).length > 0) {
            await (supabase as any).from("card_installments").update(updates).eq("id", inst.id);
            fixed++;
          }
        }
      }
      return fixed;
    },
    onSuccess: (fixed) => {
      queryClient.invalidateQueries({ queryKey: ["card_installments"] });
      queryClient.invalidateQueries({ queryKey: ["card_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["card_billing_projection"] });
      queryClient.invalidateQueries({ queryKey: ["card_invoice_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_monthly_flow_view"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_expenses_category"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_cashflow_chart"] });
      toast.success(`Reparo concluído: ${fixed} correção(ões) aplicada(s)`);
    },
    onError: (e: any) => toast.error(`Erro no reparo: ${e.message}`),
  });
}
