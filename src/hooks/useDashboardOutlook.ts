import { useQuery } from "@tanstack/react-query";
import { format, addMonths, startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { cardCycleWindow } from "@/lib/cardCycle";
import { cardLimits, monthOutlook, type LimitCard, type LimitTx, type OutlookPendingTx } from "@/lib/dashboardOutlook";

type ViewType = "consolidated" | "personal" | "business";
const PAGE = 1000;

// Busca paginada: evita o corte de 1000 linhas da API.
async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export function useDashboardOutlook(view: ViewType, selectedMonth: Date) {
  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(startOfMonth(addMonths(selectedMonth, 1)), "yyyy-MM-dd");
  const refMonth = monthStart.slice(0, 7);
  const today = format(new Date(), "yyyy-MM-dd");

  const outlook = useQuery({
    queryKey: ["dashboard_outlook", view, monthEnd],
    staleTime: 0,
    queryFn: async () => {
      const { data: ents, error: entErr } = await (supabase as any)
        .from("financial_entities").select("id, entity_type").eq("is_active", true);
      if (entErr) throw entErr;
      const entityIds = view === "consolidated" ? null
        : (ents || []).filter((e: any) => e.entity_type === view).map((e: any) => e.id);

      const { data: accounts, error: accErr } = await (supabase as any)
        .from("accounts").select("name, current_balance, financial_entity_id").eq("is_active", true);
      if (accErr) throw accErr;

      const pending = await fetchAll<OutlookPendingTx>((from, to) =>
        (supabase as any)
          .from("transactions")
          .select("amount, transaction_type, financial_entity_id, due_date, competence_date")
          .eq("status", "planned")
          .or(`due_date.lt.${monthEnd},and(due_date.is.null,competence_date.lt.${monthEnd})`)
          .order("id")
          .range(from, to));

      return monthOutlook(accounts || [], pending, entityIds, monthEnd, today);
    },
  });

  const limits = useQuery({
    queryKey: ["dashboard_card_limits", view, refMonth],
    staleTime: 0,
    queryFn: async () => {
      const { data: cardsData, error: cErr } = await (supabase as any)
        .from("cards")
        .select("name, due_day, credit_limit, managerial_limit, is_active, financial_entities(entity_type)")
        .eq("is_active", true)
        .order("name");
      if (cErr) throw cErr;
      const cards: LimitCard[] = (cardsData || [])
        .map((c: any) => ({ ...c, entity_type: c.financial_entities?.entity_type ?? null }))
        .filter((c: LimitCard) => view === "consolidated" || c.entity_type === view);
      if (cards.length === 0) return [];

      const names = cards.map((c) => c.name);
      const windows = cards.map((c) => cardCycleWindow(refMonth, c.due_day));
      const minStart = windows.reduce((m, w) => (w.start < m ? w.start : m), windows[0].start);
      const maxEnd = windows.reduce((m, w) => (w.end > m ? w.end : m), windows[0].end);

      const txs = await fetchAll<LimitTx>((from, to) =>
        (supabase as any)
          .from("transactions")
          .select("center_cost, amount, status, due_date")
          .in("center_cost", names)
          .neq("status", "cancelled")
          .or(`status.eq.planned,and(due_date.gte.${minStart},due_date.lte.${maxEnd})`)
          .order("id")
          .range(from, to));

      return cardLimits(cards, txs, refMonth);
    },
  });

  return {
    outlook: outlook.data ?? null,
    outlookLoading: outlook.isLoading,
    limits: limits.data ?? [],
    limitsLoading: limits.isLoading,
  };
}
