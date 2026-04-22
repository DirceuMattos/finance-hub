import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export type ViewType = "consolidated" | "personal" | "business";

export interface DashboardAlert {
  reference_month: string;
  financial_entity_id: string;
  severity: string;
  alert_type: string;
  title: string;
  message: string;
}

export function useAlerts(viewType: ViewType) {
  return useQuery({
    queryKey: ["dashboard-alerts", viewType],
    queryFn: async () => {
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      const futureMonth = new Date(today.getFullYear(), today.getMonth() + 3, 1);
      const futureMonthStr = `${futureMonth.getFullYear()}-${String(futureMonth.getMonth() + 1).padStart(2, "0")}-01`;

      let query = (supabase as any)
        .from("vw_dashboard_alerts")
        .select("*")
        .gte("reference_month", currentMonth)
        .lte("reference_month", futureMonthStr)
        .order("reference_month")
        .order("severity");

      if (viewType === "personal") {
        query = query.eq("entity_type", "personal");
      } else if (viewType === "business") {
        query = query.eq("entity_type", "business");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DashboardAlert[];
    },
  });
}
