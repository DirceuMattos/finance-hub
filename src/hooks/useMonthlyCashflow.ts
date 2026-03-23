import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface MonthlyCashflow {
  reference_month: string;
  total_income: number;
  total_expense: number;
  net_balance: number;
  accumulated_balance?: number;
  [key: string]: any; // allow extra columns from views
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
