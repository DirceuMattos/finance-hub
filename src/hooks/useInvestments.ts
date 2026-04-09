import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";

export interface InvestmentClass {
  id: string;
  name: string;
  is_active: boolean;
}

export interface InvestmentSnapshot {
  id: string;
  reference_month: string;
  investment_class_id: string;
  financial_entity_id: string;
  opening_value: number;
  closing_value: number;
  created_at: string;
  updated_at: string;
  investment_classes?: { name: string };
  financial_entities?: { name: string };
}

export interface InvestmentReturnByClass {
  reference_month: string;
  financial_entity_id: string;
  investment_class_id: string;
  investment_class_name: string;
  institution_name: string;
  opening_value: number;
  closing_value: number;
  contributions: number;
  redemptions: number;
  migrations_in: number;
  migrations_out: number;
  fees: number;
  manual_yield: number;
  estimated_return: number;
}

export interface InvestmentPortfolioSummary {
  reference_month: string;
  financial_entity_id: string;
  total_portfolio_value: number;
  total_estimated_return: number;
  total_contributions: number;
  total_redemptions: number;
  total_migrations_in: number;
  total_migrations_out: number;
}

export function useInvestmentClasses() {
  return useQuery({
    queryKey: ["investment_classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_classes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as InvestmentClass[];
    },
  });
}

export function useInvestmentSnapshots(month?: string) {
  return useQuery({
    queryKey: ["investment_snapshots", month],
    queryFn: async () => {
      let query = supabase
        .from("investment_snapshots")
        .select("*, investment_classes(name), financial_entities(name)")
        .order("closing_value", { ascending: false });
      if (month) {
        query = query.eq("reference_month", month);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as InvestmentSnapshot[];
    },
  });
}

export function useInvestmentReturnByClass() {
  return useQuery({
    queryKey: ["vw_investment_return_by_class"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_investment_return_by_class")
        .select("*")
        .order("reference_month");
      if (error) throw error;
      return data as InvestmentReturnByClass[];
    },
  });
}

export function useInvestmentPortfolioSummary() {
  return useQuery({
    queryKey: ["vw_investment_portfolio_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_investment_portfolio_summary")
        .select("*")
        .order("reference_month");
      if (error) throw error;
      return data as InvestmentPortfolioSummary[];
    },
  });
}

export function useInvestmentCrud() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["investment_snapshots"] });
    queryClient.invalidateQueries({ queryKey: ["vw_investment_return_by_class"] });
    queryClient.invalidateQueries({ queryKey: ["vw_investment_portfolio_summary"] });
  };

  const normalizeMonth = (data: Partial<InvestmentSnapshot>) => {
    const copy = { ...data };
    // HTML month input sends "YYYY-MM"; DB date column needs "YYYY-MM-DD"
    if (copy.reference_month && copy.reference_month.length === 7) {
      copy.reference_month = `${copy.reference_month}-01`;
    }
    return copy;
  };

  const create = useMutation({
    mutationFn: async (snapshot: Partial<InvestmentSnapshot>) => {
      const payload = normalizeMonth(snapshot);
      const { error } = await (supabase as any).from("investment_snapshots").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro criado com sucesso"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InvestmentSnapshot> & { id: string }) => {
      const { error } = await (supabase as any).from("investment_snapshots").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro atualizado"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("investment_snapshots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro excluído"); },
    onError: (e: any) => toast.error(getUserErrorMessage(e)),
  });

  return { create, update, remove };
}
