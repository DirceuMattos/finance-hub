import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ViewType = "consolidated" | "personal" | "business";

export interface DashboardAlert {
  id: string;
  title: string;
  description: string;
  severity: string;
  entity_type: string;
  reference_date: string | null;
  created_at: string | null;
}

export function useAlerts(viewType: ViewType) {
  return useQuery({
    queryKey: ["dashboard-alerts", viewType],
    queryFn: async () => {
      let query = supabase.from("vw_dashboard_alerts").select("*");

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
