import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface AssetCategory {
  id: string;
  name: string;
  asset_type: string;
  is_active: boolean;
}

export interface PatrimonySnapshot {
  id: string;
  reference_month: string;
  item_name: string;
  asset_category_id: string;
  financial_entity_id: string;
  opening_value: number;
  closing_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  asset_categories?: { name: string; asset_type: string };
  financial_entities?: { name: string };
}

export interface PatrimonyEvolution {
  reference_month: string;
  financial_entity_id: string;
  total_assets: number;
  total_liabilities: number;
  net_patrimony: number;
  opening_net_patrimony: number;
  monthly_variation: number;
}

export function useAssetCategories() {
  return useQuery({
    queryKey: ["asset_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as AssetCategory[];
    },
  });
}

export function usePatrimonySnapshots(month?: string) {
  return useQuery({
    queryKey: ["patrimony_snapshots", month],
    queryFn: async () => {
      let query = supabase
        .from("patrimony_snapshots")
        .select("*, asset_categories(name, asset_type), financial_entities(name)")
        .order("item_name");
      if (month) {
        query = query.eq("reference_month", month);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as PatrimonySnapshot[];
    },
  });
}

export function usePatrimonyEvolution() {
  return useQuery({
    queryKey: ["vw_patrimony_evolution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_patrimony_evolution")
        .select("*")
        .order("reference_month");
      if (error) throw error;
      return data as PatrimonyEvolution[];
    },
  });
}
