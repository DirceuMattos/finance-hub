import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format, addMonths, startOfMonth, parseISO } from "date-fns";
import type { FinancialEntity } from "@/types/database";

type ViewType = "consolidated" | "personal" | "business";

const monthRange = (month: Date) => {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end = format(startOfMonth(addMonths(month, 1)), "yyyy-MM-dd");
  return { start, end };
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
    staleTime: 0,
  });

  const entities = entitiesQuery.data ?? [];
  const entityTypeMap = (type: string) => entities.filter(e => e.entity_type === type).map(e => e.id);
  const personalIds = entityTypeMap("personal");
  const businessIds = entityTypeMap("business");
  const filterIds = view === "personal" ? personalIds : view === "business" ? businessIds : null;

  // --- Account balances ---
  const accountBalances = useQuery({
    queryKey: ["dashboard_account_balances_split", view],
    staleTime: 0,
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
    enabled: entitiesQuery.isFetched,
  });

  // --- Monthly cashflow calculated directly from transactions + card_installments ---
  const monthlyFlow = useQuery({
    queryKey: ["dashboard_monthly_flow_view", start, view],
    staleTime: 0,
    queryFn: async () => {
      // Fetch transactions for the selected month
      let txQuery = (supabase as any)
        .from("transactions")
        .select("amount, transaction_type, status, financial_entity_id, center_cost")
        .neq("status", "cancelled")
        .gte("competence_date", start)
        .lt("competence_date", end);

      if (filterIds && filterIds.length > 0) {
        txQuery = txQuery.in("financial_entity_id", filterIds);
      }

      const { data: txData, error: txError } = await txQuery;
      if (txError) throw txError;

      // Fetch card installments for the selected month
      let cardData: any[] = [];
      try {
        const { data: instData, error: instError } = await (supabase as any)
          .from("card_installments")
          .select("amount, status, card_purchases!inner(financial_entity_id, status)")
          .filter("billing_month", "gte", start)
          .filter("billing_month", "lt", end);

        if (!instError && instData) {
          // Filter by entity if needed
          if (filterIds && filterIds.length > 0) {
            cardData = instData.filter((inst: any) =>
              filterIds.includes(inst.card_purchases?.financial_entity_id)
            );
          } else {
            cardData = instData;
          }
        }
      } catch {
        // table may not exist
      }

      // Aggregate transactions
      let income_paid = 0;
      let income_planned = 0;
      let expense_paid = 0;
      let expense_planned = 0;

      for (const tx of (txData || []) as any[]) {
        const amt = Math.abs(tx.amount || 0);
        const isIncome = tx.transaction_type === "income" || tx.transaction_type === "receita";
        const isPaid = tx.status === "paid";

        if (isIncome) {
          if (isPaid) income_paid += amt;
          else income_planned += amt;
        } else {
          if (isPaid) expense_paid += amt;
          else expense_planned += amt;
        }
      }

      // Aggregate card installments — only unpaid count as projected
      let projected_card_amount = 0;
      let card_paid_amount = 0;

      for (const inst of cardData) {
        const amt = Math.abs(inst.amount || 0);
        if (inst.status === "paid") {
          card_paid_amount += amt;
        } else {
          projected_card_amount += amt;
        }
      }

      // Adicionar transações com center_cost de cartão
      for (const tx of (txData || []) as any[]) {
        if (!tx.center_cost) continue;
        if (!["Cartão de Crédito - Pessoal","Cartão de Crédito - Prof.",
              "Cartões de Crédito - Pessoal","Cartões de Crédito - Prof."].includes(tx.center_cost)) continue;
        if (tx.status === "paid") continue;
        projected_card_amount += Math.abs(tx.amount || 0);
      }

      // Projected balance: total income - total expenses - all card amounts
      const totalIncome = income_paid + income_planned;
      const totalExpense = expense_paid + expense_planned;
      const projected_balance = totalIncome - totalExpense;

      // Potential containment = planned expenses that could be cut
      const potential_containment = expense_planned;

      // Fetch minimum reserve from system parameters
      let minimum_reserve = 0;
      try {
        const { data: paramData } = await (supabase as any)
          .from("system_parameters")
          .select("parameter_value")
          .eq("parameter_key", "minimum_reserve")
          .maybeSingle();
        if (paramData) minimum_reserve = Number(paramData.parameter_value) || 0;
      } catch {
        // ignore
      }

      // Traffic light
      let traffic_light = "green";
      if (projected_balance < 0) {
        traffic_light = "red";
      } else if (projected_balance < minimum_reserve) {
        traffic_light = "yellow";
      }

      return {
        income_paid,
        income_planned,
        expense_paid,
        expense_planned,
        projected_card_amount,
        card_paid_amount,
        projected_balance,
        potential_containment,
        minimum_reserve,
        traffic_light,
      };
    },
    enabled: entitiesQuery.isFetched,
  });

  const cardMonthTotal = useQuery({
    queryKey: ["dashboard_card_month_total", start, view],
    staleTime: 0,
    queryFn: async () => {
      const entityIds = filterIds && filterIds.length > 0 ? filterIds : null;
      const { data, error } = await (supabase as any).rpc("get_card_month_total", {
        p_start: start,
        p_end: end,
        p_entity_ids: entityIds,
      });
      if (error) throw error;
      return Number(data) || 0;
    },
  });

  const flow = monthlyFlow.data;

  // Forecast directly from calculated data
  const forecast: MonthForecast = {
    income_paid: flow?.income_paid ?? 0,
    income_planned: flow?.income_planned ?? 0,
    expense_paid: flow?.expense_paid ?? 0,
    expense_planned: flow?.expense_planned ?? 0,
    projected_balance: flow?.projected_balance ?? 0,
    projected_card_amount: cardMonthTotal.data !== undefined ? cardMonthTotal.data : (flow?.projected_card_amount ?? 0),
    potential_containment: flow?.potential_containment ?? 0,
  };

  // --- Risk ---
  const trafficLight = flow?.traffic_light ?? "green";
  const minimumReserve = flow?.minimum_reserve ?? 0;
  const projectedBalance = flow?.projected_balance ?? 0;
  const cardPlannedTotal = cardMonthTotal.data !== undefined ? cardMonthTotal.data : (flow?.projected_card_amount ?? 0);

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

  // --- Expenses by category ---
  const expensesByCategory = useQuery({
    queryKey: ["dashboard_expenses_category", start, view],
    staleTime: 0,
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
        map.set(name, (map.get(name) || 0) + Math.abs(t.amount));
      }
      return Array.from(map.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
    },
    enabled: entitiesQuery.isFetched,
  });

  // --- Cashflow chart (12 months, calculated directly) ---
  const cashflowChart = useQuery({
    queryKey: ["dashboard_cashflow_chart", view],
    staleTime: 0,
    queryFn: async () => {
      // Fetch all transactions
      let txQuery = (supabase as any)
        .from("transactions")
        .select("amount, competence_date, transaction_type, status, financial_entity_id")
        .neq("status", "cancelled")
        .order("competence_date");

      if (filterIds && filterIds.length > 0) {
        txQuery = txQuery.in("financial_entity_id", filterIds);
      }

      const { data: txData, error: txError } = await txQuery;
      if (txError) return [];

      // Aggregate by month
      const monthMap = new Map<string, { income_paid: number; expense_paid: number; projected_balance: number }>();

      for (const tx of (txData || []) as any[]) {
        const month = (tx.competence_date || "").substring(0, 7);
        if (!month || month.length < 7) continue;

        let entry = monthMap.get(month);
        if (!entry) {
          entry = { income_paid: 0, expense_paid: 0, projected_balance: 0 };
          monthMap.set(month, entry);
        }

        const amt = Math.abs(tx.amount || 0);
        const isIncome = tx.transaction_type === "income" || tx.transaction_type === "receita";

        if (isIncome) {
          if (tx.status === "paid") entry.income_paid += amt;
        } else {
          if (tx.status === "paid") entry.expense_paid += amt;
        }
      }

      // Calculate projected_balance per month
      const entries = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, data]) => ({
          reference_month: month + "-01",
          income_paid: data.income_paid,
          expense_paid: data.expense_paid,
          projected_balance: data.income_paid - data.expense_paid,
        }));

      return entries;
    },
    enabled: entitiesQuery.isFetched,
  });

  // --- Patrimony total ---
  const patrimonyData = useQuery({
    queryKey: ["dashboard_patrimony", view],
    staleTime: 0,
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
    enabled: entitiesQuery.isFetched,
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

  // --- Investment total ---
  const investmentData = useQuery({
    queryKey: ["dashboard_investments", view],
    staleTime: 0,
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
