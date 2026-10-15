import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  monthBounds, referenceMonths, variableEstimates,
  type PaidExpense, type ProjAccount, type ProjCard, type ProjCategory, type ProjTx, type VariableEstimate,
} from "@/lib/monthProjection";

export type ProjectionView = "consolidated" | "personal" | "business";
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

export interface ProjectionData {
  accounts: ProjAccount[];
  planned: ProjTx[];
  cards: ProjCard[];
  categories: ProjCategory[];
  estimates: VariableEstimate[];
  entityTypes: Record<string, string>;
  refMonths: string[];
}

/** Dados da projeção do mês `month` (yyyy-MM), filtrados pela visão PF/PJ. Somente leitura. */
export function useMonthProjection(view: ProjectionView, month: string, today: string) {
  return useQuery({
    queryKey: ["month_projection", view, month, today],
    staleTime: 60_000,
    queryFn: async (): Promise<ProjectionData> => {
      const { start: monthStart, end: monthEnd } = monthBounds(month);
      const refMonths = referenceMonths(today, 3);
      const refStart = `${refMonths[0]}-01`;

      const [ents, accs, cardsRes, cats] = await Promise.all([
        (supabase as any).from("financial_entities").select("id, entity_type").eq("is_active", true),
        (supabase as any).from("accounts").select("id, name, current_balance, financial_entity_id").eq("is_active", true).order("name"),
        (supabase as any).from("cards").select("name, managerial_limit, financial_entity_id").eq("is_active", true),
        (supabase as any).from("categories").select("id, name, category_group, transaction_nature"),
      ]);
      for (const r of [ents, accs, cardsRes, cats]) if (r.error) throw r.error;

      const entityTypes: Record<string, string> = {};
      (ents.data || []).forEach((e: any) => { entityTypes[e.id] = e.entity_type; });
      const inView = (entityId: string) => view === "consolidated" || entityTypes[entityId] === view;

      const accounts: ProjAccount[] = (accs.data || [])
        .filter((a: any) => inView(a.financial_entity_id))
        .map((a: any) => ({ id: a.id, name: a.name, entityId: a.financial_entity_id, balance: Number(a.current_balance) || 0 }));
      const cards: ProjCard[] = (cardsRes.data || [])
        .filter((c: any) => inView(c.financial_entity_id))
        .map((c: any) => ({ name: c.name, entityId: c.financial_entity_id, managerialLimit: Number(c.managerial_limit) || 0 }));
      const categories: ProjCategory[] = (cats.data || [])
        .map((c: any) => ({ id: c.id, name: c.name, group: c.category_group, nature: c.transaction_nature }));

      // Previstos até o fim do mês projetado (inclui atrasados).
      const plannedRaw = await fetchAll<any>((from, to) =>
        (supabase as any)
          .from("transactions")
          .select("id, description, amount, transaction_type, financial_entity_id, account_id, category_id, center_cost, due_date, competence_date")
          .eq("status", "planned")
          .or(`due_date.lte.${monthEnd},and(due_date.is.null,competence_date.lte.${monthEnd})`)
          .order("id")
          .range(from, to));
      const planned: ProjTx[] = plannedRaw
        .filter((t) => inView(t.financial_entity_id))
        .map((t): ProjTx => ({
          id: t.id,
          description: t.description || "",
          amount: Math.abs(Number(t.amount) || 0),
          type: t.transaction_type === "income" ? "income" : "expense",
          entityId: t.financial_entity_id,
          accountId: t.account_id,
          categoryId: t.category_id,
          cardName: t.center_cost ? String(t.center_cost) : null,
          date: (t.due_date || t.competence_date) as string,
        }))
        .filter((t) => !!t.date);

      // Despesas pagas: meses de referência (média) e o próprio mês projetado (o que já saiu conta como lançado).
      const paidRaw = await fetchAll<any>((from, to) =>
        (supabase as any)
          .from("transactions")
          .select("category_id, amount, financial_entity_id, payment_date, competence_date, due_date")
          .eq("status", "paid")
          .eq("transaction_type", "expense")
          .or(`payment_date.gte.${refStart},and(payment_date.is.null,competence_date.gte.${refStart})`)
          .order("id")
          .range(from, to));
      const paid: PaidExpense[] = paidRaw
        .filter((t) => inView(t.financial_entity_id))
        .map((t) => ({
          categoryId: t.category_id,
          entityId: t.financial_entity_id,
          amount: Math.abs(Number(t.amount) || 0),
          date: (t.payment_date || t.competence_date || t.due_date) as string,
        }))
        .filter((t) => !!t.date);

      const inMonth: Record<string, number> = {};
      const add = (cat: string | null, v: number) => { if (cat) inMonth[cat] = (inMonth[cat] || 0) + v; };
      paid.filter((p) => p.date >= monthStart && p.date <= monthEnd).forEach((p) => add(p.categoryId, p.amount));
      planned.filter((t) => t.type === "expense" && t.date >= monthStart && t.date <= monthEnd).forEach((t) => add(t.categoryId, t.amount));

      return {
        accounts,
        planned,
        cards,
        categories,
        estimates: variableEstimates(paid, inMonth, categories, refMonths),
        entityTypes,
        refMonths,
      };
    },
  });
}
