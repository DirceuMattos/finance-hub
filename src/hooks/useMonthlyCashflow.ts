import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface MonthlyCashflow {
  reference_month: string;
  current_balance_base: number;
  income_planned: number;
  income_paid: number;
  expense_planned: number;
  expense_paid: number;
  projected_card_amount: number;
  potential_containment: number;
  total_portfolio_value: number;
  investment_estimated_return: number;
  projected_balance: number;
  minimum_reserve: number;
  traffic_light: string;
  [key: string]: any;
}

type ViewName = "consolidated" | "personal" | "business";

const viewMap: Record<ViewName, string> = {
  consolidated: "vw_monthly_cashflow_consolidated",
  personal: "vw_monthly_cashflow_personal",
  business: "vw_monthly_cashflow_business",
};

export function useMonthlyCashflow(view: ViewName) {
  return useQuery({
    queryKey: ["monthly_cashflow", view],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(viewMap[view])
        .select("*")
        .order("reference_month");
      if (error) throw error;
      return data as MonthlyCashflow[];
    },
  });
}
