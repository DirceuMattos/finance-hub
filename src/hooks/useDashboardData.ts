import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format, addMonths, startOfMonth, parseISO } from "date-fns";
import type { FinancialEntity } from "@/types/database";
import type { MonthlyCashflow } from "@/hooks/useMonthlyCashflow";

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

export interface CategoryBreakdown {
  name: string;
  total: number;
}

export interface MonthForecast {
  income_paid: number;
  income_planned: number;
  expense_paid: number;
  expense_planned: number;
  projected_balance: number;
  projected_card_amount: number;
  potential_containment: number;
}

const fmtCur = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function useDashboardData(view: ViewType = "consolidated", selectedMonth: Date = new Date()) {
  const { start, end } = monthRange(selectedMonth);
  const monthStr = format(startOfMonth(selectedMonth), "yyyy-MM-dd");

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

  // --- Account balances ---
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

  // --- Monthly cashflow from view (single source of truth) ---
  const monthlyFlow = useQuery({
    queryKey: ["dashboard_monthly_flow_view", start, view],
    queryFn: async () => {
      const viewName = cashflowViewMap[view];
      const { data, error } = await (supabase as any)
        .from(viewName)
        .select("*")
        .eq("reference_month", monthStr)
        .maybeSingle();
      if (error) throw error;
      return data as MonthlyCashflow | null;
    },
  });

  const flow = monthlyFlow.data;

  // Forecast directly from view — zero recalculation
  const forecast: MonthForecast = {
    income_paid: flow?.income_paid ?? 0,
    income_planned: flow?.income_planned ?? 0,
    expense_paid: flow?.expense_paid ?? 0,
    expense_planned: flow?.expense_planned ?? 0,
    projected_balance: flow?.projected_balance ?? 0,
    projected_card_amount: flow?.projected_card_amount ?? 0,
    potential_containment: flow?.potential_containment ?? 0,
  };

  // --- Risk: directly from view's traffic_light ---
  const trafficLight = flow?.traffic_light ?? "green";
  const minimumReserve = flow?.minimum_reserve ?? 0;
  const projectedBalance = flow?.projected_balance ?? 0;
  const cardPlannedTotal = flow?.projected_card_amount ?? 0;

  const riskLevelMap: Record<string, "controlled" | "attention" | "critical"> = {
    green: "controlled",
    yellow: "attention",
    red: "critical",
  };
  const riskLevel = riskLevelMap[trafficLight] ?? "controlled";

  const riskMessageMap: Record<string, string> = {
    green: "Mês controlado. Saldo de fechamento acima da reserva.",
    yellow: "Atenção: resultado apertado ou cartão com peso relevante.",
    red: "Risco de fechamento negativo ou abaixo da reserva mínima.",
  };

  const riskData = {
    level: riskLevel,
    closingBalance: projectedBalance,
    reserveMin: minimumReserve,
    cardPlannedTotal,
    forecastResult: projectedBalance,
    message: riskMessageMap[trafficLight] ?? riskMessageMap.green,
  };

  // --- Expenses by category (no dedicated view — keep query) ---
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

  // --- Cashflow chart (12 months from view) ---
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

  // --- Investment total (latest month, with effective closing logic) ---
  const investmentData = useQuery({
    queryKey: ["dashboard_investments", view],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("investment_snapshots")
        .select("closing_value, opening_value, reference_month, investment_class_id, financial_entity_id, investment_classes(name)")
        .order("reference_month", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return { total: 0, byClass: [] };

      const allData = data as any[];
      const latestMonth = allData[0].reference_month;
      const latestItems = allData.filter((d: any) => d.reference_month === latestMonth);

      const filtered = filterIds && filterIds.length > 0
        ? latestItems.filter((d: any) => filterIds.includes(d.financial_entity_id))
        : latestItems;

      // Effective closing: if closing_value is 0, use next month's opening_value
      const getEffective = (item: any) => {
        if (item.closing_value > 0) return item.closing_value;
        const nextMonthStr = format(addMonths(parseISO(item.reference_month), 1), "yyyy-MM-dd");
        const next = allData.find(
          (d: any) =>
            d.reference_month === nextMonthStr &&
            d.investment_class_id === item.investment_class_id &&
            d.financial_entity_id === item.financial_entity_id
        );
        if (next?.opening_value > 0) return next.opening_value;
        // Fallback: use opening_value of current month when no closing or next month exists
        return item.opening_value > 0 ? item.opening_value : item.closing_value;
      };

      const total = filtered.reduce((s: number, d: any) => s + getEffective(d), 0);

      const classMap = new Map<string, number>();
      filtered.forEach((d: any) => {
        const name = d.investment_classes?.name || "Outros";
        classMap.set(name, (classMap.get(name) || 0) + getEffective(d));
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
    flow: monthlyFlow.data,
    forecast,
    expensesByCategory: expensesByCategory.data ?? [],
    patrimony: patrimonyData.data ?? { total: 0, byCategory: [], latestMonth: null },
    patrimonyEvolution: patrimonyEvolution.data ?? [],
    investment: investmentData.data ?? { total: 0, byClass: [] },
    riskData,
    isLoading: accountBalances.isLoading || monthlyFlow.isLoading,
    fmt: fmtCur,
  };
}
