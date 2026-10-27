import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { isForecast } from "@/lib/cardForecast";
import {
  dropInternalTransfers, monthBounds, recurrenceOccurrences, referenceMonths, variableEstimates,
  type PaidExpense, type ProjAccount, type ProjCard, type ProjCategory, type ProjRecurrence, type ProjTx, type VariableEstimate,
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
  planned: ProjTx[];          // lançados + ocorrências de recorrências ainda não geradas
  cards: ProjCard[];
  categories: ProjCategory[];
  estimatesByMonth: Record<string, VariableEstimate[]>;
  entityTypes: Record<string, string>;
  refMonths: string[];
  months: string[];           // horizonte (yyyy-MM), do mês atual em diante
  avgIncome: number;          // média mensal recebida nos meses de referência
  virtualCount: number;       // ocorrências de recorrência projetadas
}

/** Dados da projeção para os próximos `horizon` meses, filtrados pela visão PF/PJ. Somente leitura. */
export function useMonthProjection(view: ProjectionView, today: string, horizon = 3) {
  return useQuery({
    queryKey: ["month_projection", view, today, horizon],
    staleTime: 60_000,
    queryFn: async (): Promise<ProjectionData> => {
      const [ty, tm] = today.split("-").map(Number);
      const months = Array.from({ length: horizon }, (_, i) => {
        const d = new Date(ty, tm - 1 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });
      const horizonEnd = monthBounds(months[months.length - 1]).end;
      const refMonths = referenceMonths(today, 3);
      const refStart = `${refMonths[0]}-01`;

      const [ents, accs, cardsRes, cats, recs] = await Promise.all([
        (supabase as any).from("financial_entities").select("id, entity_type").eq("is_active", true),
        (supabase as any).from("accounts").select("id, name, current_balance, financial_entity_id").eq("is_active", true).order("name"),
        (supabase as any).from("cards").select("name, managerial_limit, due_day, financial_entity_id").eq("is_active", true),
        (supabase as any).from("categories").select("id, name, category_group, transaction_nature"),
        (supabase as any).from("recurrences")
          .select("id, description, amount, transaction_type, financial_entity_id, account_id, category_id, center_cost, frequency, due_day, day_of_week, starts_on, ends_on")
          .eq("is_active", true),
      ]);
      for (const r of [ents, accs, cardsRes, cats, recs]) if (r.error) throw r.error;

      const entityTypes: Record<string, string> = {};
      (ents.data || []).forEach((e: any) => { entityTypes[e.id] = e.entity_type; });
      const inView = (entityId: string) => view === "consolidated" || entityTypes[entityId] === view;

      const accounts: ProjAccount[] = (accs.data || [])
        .filter((a: any) => inView(a.financial_entity_id))
        .map((a: any) => ({ id: a.id, name: a.name, entityId: a.financial_entity_id, balance: Number(a.current_balance) || 0 }));
      const cards: ProjCard[] = (cardsRes.data || [])
        .filter((c: any) => inView(c.financial_entity_id))
        .map((c: any) => ({ name: c.name, entityId: c.financial_entity_id, managerialLimit: Number(c.managerial_limit) || 0, dueDay: c.due_day }));
      const categories: ProjCategory[] = (cats.data || [])
        .map((c: any) => ({ id: c.id, name: c.name, group: c.category_group, nature: c.transaction_nature }));

      // Previstos até o fim do horizonte (inclui atrasados).
      const plannedRaw = await fetchAll<any>((from, to) =>
        (supabase as any)
          .from("transactions")
          .select("id, description, amount, transaction_type, financial_entity_id, account_id, category_id, center_cost, due_date, competence_date, source_type, tags")
          .eq("status", "planned")
          .or(`due_date.lte.${horizonEnd},and(due_date.is.null,competence_date.lte.${horizonEnd})`)
          .order("id")
          .range(from, to));
      const launched: ProjTx[] = plannedRaw
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
          forecast: isForecast(t),
        }))
        .filter((t) => !!t.date);

      // Recorrências ativas: ocorrências do horizonte que ainda não viraram lançamento (qualquer status).
      const recurrences: ProjRecurrence[] = (recs.data || [])
        .filter((r: any) => inView(r.financial_entity_id) && r.starts_on)
        .map((r: any) => ({
          id: r.id, description: r.description || "", amount: Number(r.amount) || 0,
          type: r.transaction_type === "income" ? "income" : "expense",
          entityId: r.financial_entity_id, accountId: r.account_id, categoryId: r.category_id,
          cardName: r.center_cost ? String(r.center_cost) : null,
          frequency: r.frequency, dueDay: r.due_day, dayOfWeek: r.day_of_week, startsOn: r.starts_on, endsOn: r.ends_on,
        }));
      let virtual: ProjTx[] = [];
      if (recurrences.length) {
        const generated = await fetchAll<any>((from, to) =>
          (supabase as any)
            .from("transactions")
            .select("source_id, due_date")
            .eq("source_type", "recurrence")
            .in("source_id", recurrences.map((r) => r.id))
            .gte("due_date", today)
            .order("id")
            .range(from, to));
        const existing = new Set<string>(generated.map((g) => `${g.source_id}|${g.due_date}`));
        virtual = recurrenceOccurrences(recurrences, existing, today, horizonEnd);
      }
      const planned = [...launched, ...virtual];

      // Pagos desde o 1º mês de referência: média de variáveis e o que já saiu no mês atual.
      const paidRaw = await fetchAll<any>((from, to) =>
        (supabase as any)
          .from("transactions")
          .select("category_id, amount, transaction_type, financial_entity_id, payment_date, competence_date, due_date")
          .eq("status", "paid")
          .or(`payment_date.gte.${refStart},and(payment_date.is.null,competence_date.gte.${refStart})`)
          .order("id")
          .range(from, to));
      const paidView = paidRaw
        .filter((t) => inView(t.financial_entity_id))
        .map((t) => ({
          type: t.transaction_type,
          categoryId: t.category_id as string | null,
          entityId: t.financial_entity_id as string,
          amount: Math.abs(Number(t.amount) || 0),
          date: (t.payment_date || t.competence_date || t.due_date) as string,
        }))
        .filter((t) => !!t.date);
      // Transferências entre contas próprias (despesa + receita do mesmo valor) não entram na estimativa.
      const paid: PaidExpense[] = dropInternalTransfers(
        paidView.filter((t) => t.type !== "income"),
        paidView.filter((t) => t.type === "income"),
      );
      const incomeRef = paidView
        .filter((t) => t.type === "income" && refMonths.includes(t.date.slice(0, 7)))
        .reduce((s, t) => s + t.amount, 0);

      const estimatesByMonth: Record<string, VariableEstimate[]> = {};
      for (const ym of months) {
        const { start, end } = monthBounds(ym);
        const inMonth: Record<string, number> = {};
        const largest: Record<string, number> = {};
        const add = (cat: string | null, v: number) => {
          if (!cat) return;
          inMonth[cat] = (inMonth[cat] || 0) + v;
          largest[cat] = Math.max(largest[cat] || 0, v);
        };
        paid.filter((p) => p.date >= start && p.date <= end).forEach((p) => add(p.categoryId, p.amount));
        planned.filter((t) => t.type === "expense" && t.date >= start && t.date <= end).forEach((t) => add(t.categoryId, t.amount));
        estimatesByMonth[ym] = variableEstimates(paid, inMonth, categories, refMonths, largest);
      }

      return {
        accounts,
        planned,
        cards,
        categories,
        estimatesByMonth,
        entityTypes,
        refMonths,
        months,
        avgIncome: Math.round((incomeRef / refMonths.length) * 100) / 100,
        virtualCount: virtual.length,
      };
    },
  });
}
