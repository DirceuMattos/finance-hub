import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format, addMonths, startOfMonth } from "date-fns";
import type { FinancialEntity } from "@/types/database";
import {
  CARD_INVOICE_CENTER_COSTS,
  CENTER_COST_CARD_MAP,
  CENTER_COST_ENTITY_MAP,
} from "@/lib/cardInvoiceRules";

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

export interface CardSummaryItem {
  card_name: string;
  entity_type: "personal" | "business" | null;
  historicalTotal: number;
  projectedTotal: number;
  count: number;
}

export interface CategoryBreakdown {
  name: string;
  total: number;
}

export interface MonthForecast {
  income_paid: number;
  income_planned: number;
  expense_paid: number;
  expense_planned: number;
  total_income: number;
  total_expense: number;
  forecast_result: number;
}

const fmtCur = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function useDashboardData(view: ViewType = "consolidated", selectedMonth: Date = new Date()) {
  const { start, end } = monthRange(selectedMonth);

  // --- Financial entities ---
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

  // --- Account balances (consolidated + split) ---
  const accountBalances = useQuery({
    queryKey: ["dashboard_account_balances_split", view],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("accounts")
        .select("current_balance, is_active, financial_entity_id")
        .eq("is_active", true);
      if (error) throw error;

      const all = data as { current_balance: number; financial_entity_id: string }[];
      const total = all.reduce((s, a) => s + a.current_balance, 0);
      const personal = all
        .filter(a => personalIds.includes(a.financial_entity_id))
        .reduce((s, a) => s + a.current_balance, 0);
      const business = all
        .filter(a => businessIds.includes(a.financial_entity_id))
        .reduce((s, a) => s + a.current_balance, 0);

      const filtered = view === "consolidated" ? total : view === "personal" ? personal : business;

      return { total, personal, business, filtered };
    },
    enabled: entities.length > 0,
  });

  // --- Monthly flow (with planned + paid) ---
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
        // Fallback: query transactions directly
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
        const rows = txs || [];
        const income_paid = rows.filter((t: any) => t.transaction_type === "income" && t.status === "paid").reduce((s: number, t: any) => s + t.amount, 0);
        const income_planned = rows.filter((t: any) => t.transaction_type === "income" && t.status === "planned").reduce((s: number, t: any) => s + t.amount, 0);
        const expense_paid = rows.filter((t: any) => t.transaction_type === "expense" && t.status === "paid").reduce((s: number, t: any) => s + t.amount, 0);
        const expense_planned = rows.filter((t: any) => t.transaction_type === "expense" && t.status === "planned").reduce((s: number, t: any) => s + t.amount, 0);
        return { income_paid, income_planned, expense_paid, expense_planned, projected_balance: income_paid - expense_paid };
      }
      return data as { income_paid: number; income_planned: number; expense_paid: number; expense_planned: number; projected_balance: number } | null;
    },
  });

  // --- Forecast (sanitize future months: paid→planned) ---
  const flow = monthlyFlow.data;
  const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const isFutureMonth = start > currentMonthStart;

  const sanitizedFlow = {
    income_paid: isFutureMonth ? 0 : (flow?.income_paid ?? 0),
    income_planned: isFutureMonth
      ? (flow?.income_paid ?? 0) + (flow?.income_planned ?? 0)
      : (flow?.income_planned ?? 0),
    expense_paid: isFutureMonth ? 0 : (flow?.expense_paid ?? 0),
    expense_planned: isFutureMonth
      ? (flow?.expense_paid ?? 0) + (flow?.expense_planned ?? 0)
      : (flow?.expense_planned ?? 0),
  };

  const forecast: MonthForecast = {
    income_paid: sanitizedFlow.income_paid,
    income_planned: sanitizedFlow.income_planned,
    expense_paid: sanitizedFlow.expense_paid,
    expense_planned: sanitizedFlow.expense_planned,
    total_income: sanitizedFlow.income_paid + sanitizedFlow.income_planned,
    total_expense: sanitizedFlow.expense_paid + sanitizedFlow.expense_planned,
    forecast_result: (sanitizedFlow.income_paid + sanitizedFlow.income_planned) - (sanitizedFlow.expense_paid + sanitizedFlow.expense_planned),
  };

  // --- Card summary via center_cost (FILTERED BY MONTH) ---
  const cardSummary = useQuery({
    queryKey: ["dashboard_card_summary", view, start, end],
    queryFn: async () => {
      let query = (supabase as any)
        .from("transactions")
        .select("amount, competence_date, center_cost, financial_entity_id, status")
        .gte("competence_date", start)
        .lt("competence_date", end)
        .neq("status", "cancelled");

      if (filterIds && filterIds.length > 0) {
        query = query.in("financial_entity_id", filterIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items = (data || []).filter((t: any) =>
        t.center_cost && CARD_INVOICE_CENTER_COSTS.includes(t.center_cost)
      );

      const map = new Map<string, CardSummaryItem>();
      items.forEach((t: any) => {
        const cardName = CENTER_COST_CARD_MAP[t.center_cost] || t.center_cost;
        let s = map.get(cardName);
        if (!s) {
          s = {
            card_name: cardName,
            entity_type: CENTER_COST_ENTITY_MAP[t.center_cost] || null,
            historicalTotal: 0,
            projectedTotal: 0,
            count: 0,
          };
          map.set(cardName, s);
        }
        s.count += 1;
        const amt = Math.abs(t.amount);
        if (t.status === "paid") {
          s.historicalTotal += amt;
        } else {
          s.projectedTotal += amt;
        }
      });

      return Array.from(map.values());
    },
  });

  // --- Expenses by category ---
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

  // --- Cashflow chart ---
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

  // --- Patrimony total (latest month) ---
  const patrimonyData = useQuery({
    queryKey: ["dashboard_patrimony", view],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patrimony_snapshots")
        .select("closing_value, reference_month, asset_category_id, financial_entity_id, asset_categories(name)")
        .order("reference_month", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return { total: 0, byCategory: [], latestMonth: null };

      const latestMonth = data[0].reference_month;
      const latestItems = (data as any[]).filter((d: any) => d.reference_month === latestMonth);

      const filtered = filterIds && filterIds.length > 0
        ? latestItems.filter((d: any) => filterIds.includes(d.financial_entity_id))
        : latestItems;

      const total = filtered.reduce((s: number, d: any) => s + (d.closing_value || 0), 0);

      const catMap = new Map<string, number>();
      filtered.forEach((d: any) => {
        const name = d.asset_categories?.name || "Outros";
        catMap.set(name, (catMap.get(name) || 0) + (d.closing_value || 0));
      });

      const byCategory = Array.from(catMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

      return { total, byCategory, latestMonth };
    },
  });

  // --- Patrimony evolution ---
  const patrimonyEvolution = useQuery({
    queryKey: ["dashboard_patrimony_evolution"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_patrimony_evolution")
        .select("reference_month, net_patrimony")
        .order("reference_month")
        .limit(12);
      if (error) return [];
      return (data || []) as { reference_month: string; net_patrimony: number }[];
    },
  });

  // --- Investment total (latest month) ---
  const investmentData = useQuery({
    queryKey: ["dashboard_investments", view],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("investment_snapshots")
        .select("closing_value, reference_month, investment_class_id, financial_entity_id, investment_classes(name)")
        .order("reference_month", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return { total: 0, byClass: [] };

      const latestMonth = data[0].reference_month;
      const latestItems = (data as any[]).filter((d: any) => d.reference_month === latestMonth);

      const filtered = filterIds && filterIds.length > 0
        ? latestItems.filter((d: any) => filterIds.includes(d.financial_entity_id))
        : latestItems;

      const total = filtered.reduce((s: number, d: any) => s + (d.closing_value || 0), 0);

      const classMap = new Map<string, number>();
      filtered.forEach((d: any) => {
        const name = d.investment_classes?.name || "Outros";
        classMap.set(name, (classMap.get(name) || 0) + (d.closing_value || 0));
      });

      const byClass = Array.from(classMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

      return { total, byClass };
    },
  });

  const balances = accountBalances.data ?? { total: 0, personal: 0, business: 0, filtered: 0 };

  return {
    balance: balances.filtered,
    balanceSplit: { personal: balances.personal, business: balances.business, total: balances.total },
    flow: isFutureMonth ? { ...flow, income_paid: 0, expense_paid: 0, income_planned: sanitizedFlow.income_planned, expense_planned: sanitizedFlow.expense_planned } : monthlyFlow.data,
    forecast,
    cardSummary: cardSummary.data ?? [],
    expensesByCategory: expensesByCategory.data ?? [],
    patrimony: patrimonyData.data ?? { total: 0, byCategory: [], latestMonth: null },
    patrimonyEvolution: patrimonyEvolution.data ?? [],
    investment: investmentData.data ?? { total: 0, byClass: [] },
    isLoading: accountBalances.isLoading || monthlyFlow.isLoading,
    fmt: fmtCur,
  };
}
