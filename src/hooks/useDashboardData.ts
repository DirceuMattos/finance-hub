import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format, addMonths, startOfMonth } from "date-fns";
import type { FinancialEntity } from "@/types/database";

type ViewType = "consolidated" | "personal" | "business";

const monthRange = (month: Date) => {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end = format(startOfMonth(addMonths(month, 1)), "yyyy-MM-dd");
  return { start, end };
};

const cashflowViewMap: Record<ViewType, string> = {
  consolidated: "vw_monthly_cashflow_consolidated",
  personal: "vw_monthly_cashflow_personal",
  business: "vw_monthly_cashflow_business",
};

export function useDashboardData(view: ViewType = "consolidated", selectedMonth: Date = new Date()) {
  const { start, end } = monthRange(selectedMonth);

  const entitiesQuery = useQuery({
    queryKey: ["dashboard_entities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financial_entities")
        .select("id, entity_type, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data as FinancialEntity[];
    },
  });

  const entities = entitiesQuery.data ?? [];
  const entityTypeMap = (type: string) => entities.filter(e => e.entity_type === type).map(e => e.id);

  const personalIds = entityTypeMap("personal");
  const businessIds = entityTypeMap("business");
  const filterIds = view === "personal" ? personalIds : view === "business" ? businessIds : null;

  const accountBalances = useQuery({
    queryKey: ["dashboard_account_balances", view],
    queryFn: async () => {
      let query = (supabase as any)
        .from("accounts")
        .select("current_balance, is_active, financial_entity_id")
        .eq("is_active", true);
      if (filterIds && filterIds.length > 0) {
        query = query.in("financial_entity_id", filterIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as { current_balance: number }[]).reduce((s, a) => s + a.current_balance, 0);
    },
    enabled: view === "consolidated" || filterIds !== null,
  });

  const monthlyFlow = useQuery({
    queryKey: ["dashboard_monthly_flow", start, view],
    queryFn: async () => {
      const viewName = cashflowViewMap[view];
      const { data, error } = await (supabase as any)
        .from(viewName)
        .select("*")
        .gte("reference_month", start)
        .lt("reference_month", end)
        .maybeSingle();
      if (error) {
        let txQuery = (supabase as any)
          .from("transactions")
          .select("transaction_type, amount, status")
          .gte("competence_date", start)
          .lt("competence_date", end)
          .neq("status", "cancelled");
        if (filterIds && filterIds.length > 0) {
          txQuery = txQuery.in("financial_entity_id", filterIds);
        }
        const { data: txs, error: e2 } = await txQuery;
        if (e2) throw e2;
        const income = (txs || []).filter((t: any) => t.transaction_type === "income").reduce((s: number, t: any) => s + t.amount, 0);
        const expense = (txs || []).filter((t: any) => t.transaction_type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
        return { income_paid: income, expense_paid: expense, projected_balance: income - expense };
      }
      return data as { income_paid: number; expense_paid: number; projected_balance: number } | null;
    },
  });

  const cardBilling = useQuery({
    queryKey: ["dashboard_card_billing", start, view],
    queryFn: async () => {
      let cardIds: string[] | null = null;
      if (filterIds && filterIds.length > 0) {
        const { data: cards } = await (supabase as any)
          .from("cards")
          .select("id")
          .in("financial_entity_id", filterIds);
        cardIds = (cards || []).map((c: any) => c.id);
        if (cardIds!.length === 0) return { currentTotal: 0, futureTotal: 0 };
      }

      let query = (supabase as any)
        .from("card_installments")
        .select("amount, billing_month, status")
        .in("status", ["pending", "open"]);
      
      if (cardIds) {
        const { data: purchases } = await (supabase as any)
          .from("card_purchases")
          .select("id")
          .in("card_id", cardIds);
        const purchaseIds = (purchases || []).map((p: any) => p.id);
        if (purchaseIds.length === 0) return { currentTotal: 0, futureTotal: 0 };
        query = query.in("card_purchase_id", purchaseIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      const items = data as { amount: number; billing_month: string; status: string }[];
      const currentTotal = items.filter(i => i.billing_month >= start && i.billing_month < end).reduce((s, i) => s + i.amount, 0);
      const futureTotal = items.filter(i => i.billing_month >= end).reduce((s, i) => s + i.amount, 0);
      return { currentTotal, futureTotal };
    },
  });

  const expensesByCategory = useQuery({
    queryKey: ["dashboard_expenses_category", start, view],
    queryFn: async () => {
      let query = (supabase as any)
        .from("transactions")
        .select("amount, categories(name)")
        .eq("transaction_type", "expense")
        .neq("status", "cancelled")
        .gte("competence_date", start)
        .lt("competence_date", end);
      if (filterIds && filterIds.length > 0) {
        query = query.in("financial_entity_id", filterIds);
      }
      const { data, error } = await query;
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
    queryKey: ["dashboard_cashflow_chart", view],
    queryFn: async () => {
      const viewName = cashflowViewMap[view];
      const { data, error } = await (supabase as any)
        .from(viewName)
        .select("reference_month, income_paid, expense_paid, projected_balance")
        .order("reference_month")
        .limit(12);
      if (error) return [];
      return (data || []) as { reference_month: string; income_paid: number; expense_paid: number; projected_balance: number }[];
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
