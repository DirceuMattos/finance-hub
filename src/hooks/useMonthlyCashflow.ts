import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface MonthlyCashflow {
  reference_month: string;
  current_balance_base: number;
  income_planned: number;
  income_paid: number;
  expense_planned: number;
  expense_paid: number;
  projected_card_amount: number;
  card_paid_amount: number;
  potential_containment: number;
  total_portfolio_value: number;
  investment_estimated_return: number;
  projected_balance: number;
  minimum_reserve: number;
  traffic_light: string;
  [key: string]: any;
}

type ViewName = "consolidated" | "personal" | "business";

export function useMonthlyCashflow(view: ViewName) {
  return useQuery({
    queryKey: ["monthly_cashflow", view],
    staleTime: 0,
    queryFn: async () => {
      // 1. Fetch all transactions with entity info
      const { data: txData, error: txError } = await (supabase as any)
        .from("transactions")
        .select("amount, competence_date, due_date, transaction_type, status, financial_entities(entity_type)")
        .in("status", ["paid", "planned"])
        .order("competence_date");
      console.log("txData count:", txData?.length, "txError:", txError);
      if (txError) throw txError;

      // 2. Fetch card installments with entity info
      let cardData: any[] = [];
      try {
        const { data: instData, error: instError } = await (supabase as any)
          .from("card_installments")
          .select("amount, billing_month, status, card_purchases(financial_entities(entity_type))")
          .neq("status", "cancelled")
          .order("billing_month");
        if (!instError && instData) cardData = instData;
      } catch {
        // table may not exist
      }
      console.log("cardData count:", cardData?.length);

      // Helper: check entity filter
      const matchesView = (entityType: string | null | undefined): boolean => {
        if (view === "consolidated") return true;
        if (view === "personal") return entityType === "personal" || entityType === "pessoa_fisica";
        if (view === "business") return entityType === "business" || entityType === "pessoa_juridica";
        return true;
      };

      // 3. Aggregate by month
      const monthMap = new Map<string, MonthlyCashflow>();

      const getOrCreate = (month: string): MonthlyCashflow => {
        let entry = monthMap.get(month);
        if (!entry) {
          entry = {
            reference_month: month + "-01",
            current_balance_base: 0,
            income_planned: 0,
            income_paid: 0,
            expense_planned: 0,
            expense_paid: 0,
            projected_card_amount: 0,
            card_paid_amount: 0,
            potential_containment: 0,
            total_portfolio_value: 0,
            investment_estimated_return: 0,
            projected_balance: 0,
            minimum_reserve: 0,
            traffic_light: "",
          };
          monthMap.set(month, entry);
        }
        return entry;
      };

      // Process transactions
      (txData || []).forEach((tx: any) => {
        const entityType = tx.financial_entities?.entity_type;
        if (!matchesView(entityType)) return;

        const rawDate = tx.due_date || tx.competence_date || "";
        const month = rawDate.substring(0, 7);
        if (!month || month.length < 7) return;

        const entry = getOrCreate(month);
        const amt = Math.abs(tx.amount || 0);
        const isIncome = tx.transaction_type === "income" || tx.transaction_type === "receita";
        const isPaid = tx.status === "paid";

        if (isIncome) {
          if (isPaid) entry.income_paid += amt;
          else entry.income_planned += amt;
        } else {
          if (isPaid) entry.expense_paid += amt;
          else entry.expense_planned += amt;
        }
      });

      // Process card installments — separate paid vs projected
      cardData.forEach((inst: any) => {
        const entityType = inst.card_purchases?.financial_entities?.entity_type;
        if (!matchesView(entityType)) return;

        const month = (inst.billing_month || "").substring(0, 7);
        if (!month || month.length < 7) return;

        const entry = getOrCreate(month);
        const amt = Math.abs(inst.amount || 0);

        if (inst.status === "paid") {
          entry.card_paid_amount += amt;
        } else {
          entry.projected_card_amount += amt;
        }
      });

      // Calculate projected_balance and traffic_light
      const entries = Array.from(monthMap.values()).sort((a, b) =>
        a.reference_month.localeCompare(b.reference_month)
      );

      entries.forEach((entry) => {
        const totalIncome = entry.income_paid + entry.income_planned;
        const totalExpense = entry.expense_paid + entry.expense_planned + entry.projected_card_amount;
        entry.projected_balance = totalIncome - totalExpense;
        entry.potential_containment = entry.expense_planned;

        if (entry.projected_balance < 0) {
          entry.traffic_light = "red";
        } else if (entry.projected_balance < totalIncome * 0.1) {
          entry.traffic_light = "yellow";
        } else {
          entry.traffic_light = "green";
        }
      });

      console.log("useMonthlyCashflow entries:", entries.map(e => ({ month: e.reference_month, income_paid: e.income_paid, expense_paid: e.expense_paid })));
      return entries;
    },
  });
}
