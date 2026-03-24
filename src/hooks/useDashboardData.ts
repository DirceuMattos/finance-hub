import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format, addMonths, startOfMonth } from "date-fns";
import type { FinancialEntity } from "@/types/database";
import {
  CARD_INVOICE_CENTER_COSTS,
  CENTER_COST_CARD_MAP,
  CENTER_COST_ENTITY_MAP,
  CUTOFF_DATE,
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

const fmt = (v: number) =>
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

  // --- Monthly flow ---
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

  // --- Card billing (card_installments) ---
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

  // --- Card summary via center_cost ---
  const cardSummary = useQuery({
    queryKey: ["dashboard_card_summary", view],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("amount, competence_date, center_cost, financial_entity_id")
        .order("competence_date", { ascending: false });
      if (error) throw error;

      const items = (data || []).filter((t: any) =>
        t.center_cost && CARD_INVOICE_CENTER_COSTS.includes(t.center_cost)
      );

      // Apply entity filter
      const filtered = filterIds && filterIds.length > 0
        ? items.filter((t: any) => filterIds.includes(t.financial_entity_id))
        : items;

      const map = new Map<string, CardSummaryItem>();
      filtered.forEach((t: any) => {
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
        if (t.competence_date <= CUTOFF_DATE) {
          s.historicalTotal += amt;
        } else {
          s.projectedTotal += amt;
        }
      });

      return Array.from(map.values());
    },
  });

  // --- Patrimony total (latest month) ---
  const patrimonyData = useQuery({
    queryKey: ["dashboard_patrimony", view],
    queryFn: async () => {
      let query = (supabase as any)
        .from("patrimony_snapshots")
        .select("closing_value, reference_month, asset_category_id, financial_entity_id, asset_categories(name)")
        .order("reference_month", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return { total: 0, byCategory: [], latestMonth: null };

      const latestMonth = data[0].reference_month;
      const latestItems = (data as any[]).filter((d: any) => d.reference_month === latestMonth);

      // Apply entity filter
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
    flow: monthlyFlow.data,
    cardBilling: cardBilling.data ?? { currentTotal: 0, futureTotal: 0 },
    cardSummary: cardSummary.data ?? [],
    expensesByCategory: expensesByCategory.data ?? [],
    cashflowChart: cashflowChart.data ?? [],
    patrimony: patrimonyData.data ?? { total: 0, byCategory: [], latestMonth: null },
    patrimonyEvolution: patrimonyEvolution.data ?? [],
    investment: investmentData.data ?? { total: 0, byClass: [] },
    isLoading: accountBalances.isLoading || monthlyFlow.isLoading,
    fmt,
  };
}
