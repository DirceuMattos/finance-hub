import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";

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

export function usePatrimonyCrud() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["patrimony_snapshots"] });
    queryClient.invalidateQueries({ queryKey: ["vw_patrimony_evolution"] });
  };

  const create = useMutation({
    mutationFn: async (snapshot: Partial<PatrimonySnapshot>) => {
      const { error } = await (supabase as any).from("patrimony_snapshots").insert(snapshot);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro criado com sucesso"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PatrimonySnapshot> & { id: string }) => {
      const { error } = await (supabase as any).from("patrimony_snapshots").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("patrimony_snapshots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  return { create, update, remove };
}
