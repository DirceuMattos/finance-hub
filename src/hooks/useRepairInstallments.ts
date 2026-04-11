import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export function useRepairInstallments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // 1. Fetch all card_purchases with their installment_amount
      const { data: purchases, error: pErr } = await (supabase as any)
        .from("card_purchases")
        .select("id, installment_amount, total_amount, installments_count")
        .limit(5000);
      if (pErr) throw pErr;

      let fixed = 0;
      for (const p of (purchases || [])) {
        const correctAmount = p.installment_amount || (p.total_amount / p.installments_count);
        if (!correctAmount || correctAmount <= 0) continue;

        // Find installments with wrong amount
        const { data: insts, error: iErr } = await (supabase as any)
          .from("card_installments")
          .select("id, amount")
          .eq("card_purchase_id", p.id);
        if (iErr) continue;

        for (const inst of (insts || [])) {
          if (Math.abs(inst.amount - correctAmount) > 0.01) {
            await (supabase as any)
              .from("card_installments")
              .update({ amount: correctAmount })
              .eq("id", inst.id);
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
      toast.success(`Reparo concluído: ${fixed} parcela(s) corrigida(s)`);
    },
    onError: (e: any) => toast.error(`Erro no reparo: ${e.message}`),
  });
}
