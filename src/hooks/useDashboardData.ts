import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

const currentMonth = () => format(new Date(), "yyyy-MM");

export function useDashboardData() {
  const month = currentMonth();

  const accountBalances = useQuery({
    queryKey: ["dashboard_account_balances"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("accounts")
        .select("current_balance, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data as { current_balance: number }[]).reduce((s, a) => s + a.current_balance, 0);
    },
  });

  const monthlyFlow = useQuery({
    queryKey: ["dashboard_monthly_flow", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_monthly_cashflow_consolidated")
        .select("*")
        .eq("reference_month", month)
        .maybeSingle();
      if (error) {
        // Fallback: compute from transactions
        const start = `${month}-01`;
        const end = `${month}-31`;
        const { data: txs, error: e2 } = await (supabase as any)
          .from("transactions")
          .select("transaction_type, amount, status")
          .gte("competence_date", start)
          .lte("competence_date", end)
          .neq("status", "cancelled");
        if (e2) throw e2;
        const income = (txs || []).filter((t: any) => t.transaction_type === "income").reduce((s: number, t: any) => s + t.amount, 0);
        const expense = (txs || []).filter((t: any) => t.transaction_type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
        return { total_income: income, total_expense: expense, net_balance: income - expense };
      }
      return data as { total_income: number; total_expense: number; net_balance: number } | null;
    },
  });

  const cardBilling = useQuery({
    queryKey: ["dashboard_card_billing", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("card_installments")
        .select("amount, billing_month, status")
        .in("status", ["pending", "open"]);
      if (error) throw error;
      const items = data as { amount: number; billing_month: string; status: string }[];
      const currentTotal = items.filter(i => i.billing_month === month).reduce((s, i) => s + i.amount, 0);
      const futureTotal = items.filter(i => i.billing_month > month).reduce((s, i) => s + i.amount, 0);
      return { currentTotal, futureTotal };
    },
  });

  const expensesByCategory = useQuery({
    queryKey: ["dashboard_expenses_category", month],
    queryFn: async () => {
      const start = `${month}-01`;
      const end = `${month}-31`;
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("amount, categories(name)")
        .eq("transaction_type", "expense")
        .neq("status", "cancelled")
        .gte("competence_date", start)
        .lte("competence_date", end);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const t of (data || []) as { amount: number; categories: { name: string } | null }[]) {
        const name = t.categories?.name || "Sem categoria";
        map.set(name, (map.get(name) || 0) + t.amount);
      }
      return Array.from(map.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
    },
  });

  const cashflowChart = useQuery({
    queryKey: ["dashboard_cashflow_chart"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_monthly_cashflow_consolidated")
        .select("reference_month, total_income, total_expense, net_balance")
        .order("reference_month")
        .limit(12);
      if (error) {
        // Fallback empty
        return [];
      }
      return (data || []) as { reference_month: string; total_income: number; total_expense: number; net_balance: number }[];
    },
  });

  return {
    balance: accountBalances.data ?? 0,
    flow: monthlyFlow.data,
    cardBilling: cardBilling.data ?? { currentTotal: 0, futureTotal: 0 },
    expensesByCategory: expensesByCategory.data ?? [],
    cashflowChart: cashflowChart.data ?? [],
    isLoading: accountBalances.isLoading || monthlyFlow.isLoading || cardBilling.isLoading,
  };
}
