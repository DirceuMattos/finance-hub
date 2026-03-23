import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface InvestmentClass {
  id: string;
  name: string;
  institution_name: string | null;
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
