import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { monthWindow, type AnalysisRow } from "@/lib/spendAnalysis";
import { isForecast } from "@/lib/cardForecast";

const PAGE = 1000;

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

export interface AnalysisFilters {
  type: "expense" | "income";
  status: "all" | "paid" | "planned";
  categoryId: string; // "all" ou id
  accountId: string;  // "all" ou id
  month: string;      // yyyy-MM
  period: number;     // 3, 6 ou 12 meses
}

/** Lançamentos do período (somente leitura). A busca por palavras é aplicada na tela. */
export function useSpendAnalysis(f: AnalysisFilters) {
  return useQuery({
    queryKey: ["spend_analysis", f.type, f.status, f.categoryId, f.accountId, f.month, f.period],
    staleTime: 60_000,
    queryFn: async (): Promise<AnalysisRow[]> => {
      const months = monthWindow(f.month, f.period);
      const start = `${months[0]}-01`;
      const [ey, em] = f.month.split("-").map(Number);
      const end = `${f.month}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`;
      const raw = await fetchAll<any>((from, to) => {
        let q = (supabase as any)
          .from("transactions")
          .select("id, description, amount, due_date, competence_date, status, category_id, account_id, payee, notes, center_cost, source_type, tags, categories(name), accounts(name)")
          .eq("transaction_type", f.type)
          .neq("status", "cancelled")
          .or(`and(due_date.gte.${start},due_date.lte.${end}),and(due_date.is.null,competence_date.gte.${start},competence_date.lte.${end})`);
        if (f.status !== "all") q = q.eq("status", f.status);
        if (f.categoryId === "__none") q = q.is("category_id", null);
        else if (f.categoryId !== "all") q = q.eq("category_id", f.categoryId);
        if (f.accountId === "__none") q = q.is("account_id", null);
        else if (f.accountId !== "all") q = q.eq("account_id", f.accountId);
        return q.order("id").range(from, to);
      });
      return raw.map((t) => ({
        id: t.id,
        description: t.description || "",
        amount: Math.abs(Number(t.amount) || 0),
        date: (t.due_date || t.competence_date) as string,
        status: t.status,
        categoryId: t.category_id,
        categoryName: t.categories?.name ?? null,
        accountId: t.account_id,
        accountName: t.accounts?.name ?? null,
        payee: t.payee,
        notes: t.notes,
        cardName: t.center_cost || null,
        forecast: isForecast(t),
      })).filter((r) => !!r.date);
    },
  });
}
