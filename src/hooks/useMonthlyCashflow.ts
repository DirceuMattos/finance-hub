import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface MonthlyCashflow {
  reference_month: string;
  income_paid: number;
  income_planned: number;
  expense_paid: number;
  expense_planned: number;
  card_paid: number;
  card_projected: number;
  projected_balance: number;
  traffic_light: string;
  [key: string]: any;
}

type ViewName = "consolidated" | "personal" | "business";

export function useMonthlyCashflow(view: ViewName) {
  return useQuery({
    queryKey: ["monthly_cashflow", view],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_monthly_cashflow", {
        p_view: view,
        p_months: 6,
      });
      if (error) throw error;

      return (data || []).map((row: any) => {
        const income_paid = Number(row.income_paid || 0);
        const income_planned = Number(row.income_planned || 0);
        const expense_paid = Number(row.expense_paid || 0);
        const expense_planned = Number(row.expense_planned || 0);
        const card_paid = Number(row.card_paid || 0);
        const card_projected = Number(row.card_projected || 0);

        const totalIncome = income_paid + income_planned;
        const totalExpense = expense_paid + expense_planned + card_projected;
        const projected_balance = totalIncome - totalExpense;

        let traffic_light = "green";
        if (projected_balance < 0) traffic_light = "red";
        else if (projected_balance < totalIncome * 0.1) traffic_light = "yellow";

        return {
          reference_month: row.reference_month + "-01",
          income_paid,
          income_planned,
          expense_paid,
          expense_planned,
          card_paid,
          card_projected,
          projected_balance,
          traffic_light,
        } as MonthlyCashflow;
      });
    },
  });
}
