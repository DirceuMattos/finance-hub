import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CARD_INVOICE_CENTER_COSTS,
  CENTER_COST_CARD_MAP,
  CENTER_COST_ENTITY_MAP,
  CUTOFF_DATE,
} from "@/lib/cardInvoiceRules";
import { cardCycleMonthOf, cardCycleWindow } from "@/lib/cardCycle";

interface CardInvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  competence_date: string;
  due_date: string | null;
  status: string;
  center_cost: string;
  card_name: string;
  entity_type: "personal" | "business" | null;
  /** Mês (yyyy-MM) da fatura pela regra única de ciclo de vencimento. */
  cycle_month: string;
  card_id: string | null;
  card_due_day: number | null;
  /** transactions = lançamentos atuais; installments = parcelas históricas; legacy = centro de custo sem cartão */
  source: "transactions" | "installments" | "legacy";
}

export interface CardInvoiceProjection {
  card_name: string;
  billing_month: string;
  due_date: string | null;
  total_amount: number;
  invoices_count: number;
  status: string;
  card_id: string | null;
  card_due_day: number | null;
  source: "transactions" | "installments" | "legacy";
}

export interface CardInvoiceSummary {
  card_name: string;
  entity_type: "personal" | "business" | null;
  paidTotal: number;
  plannedTotal: number;
  historicalTotal: number;
  projectedTotal: number;
  count: number;
}

function useCardInvoiceTransactionsQuery() {
  return useQuery({
    queryKey: ["card_invoice_transactions"],
    queryFn: async () => {
      // Load active cards to allow dynamic center_cost matching (any card name)
      const { data: cardsData } = await (supabase as any)
        .from("cards")
        .select("id, name, due_day, financial_entities(entity_type)");
      const cardEntityMap = new Map<string, "personal" | "business" | null>();
      const cardDueDayMap = new Map<string, number | null>();
      const cardIdMap = new Map<string, string>();
      (cardsData || []).forEach((c: any) => {
        cardDueDayMap.set(c.name, c.due_day ?? null);
        cardIdMap.set(c.name, c.id);
        const t = c?.financial_entities?.entity_type;
        cardEntityMap.set(c.name, t === "personal" || t === "business" ? t : null);
      });

      // Source 1: transactions by center_cost (legacy hardcoded list + any registered card name)
      const { data: txData, error: txError } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, competence_date, due_date, status, center_cost")
        // Filtra no servidor só os centros de custo de cartão: evita o corte de linhas da API.
        .in("center_cost", Array.from(new Set([...CARD_INVOICE_CENTER_COSTS, ...cardEntityMap.keys()])))
        .neq("status", "cancelled")
        .order("competence_date", { ascending: false })
        .limit(10000);
      if (txError) throw txError;

      const fromTransactions: CardInvoiceTransaction[] = (txData || [])
        .filter((t: any) => {
          if (!t.center_cost) return false;
          if (t.status === "cancelled") return false;
          return CARD_INVOICE_CENTER_COSTS.includes(t.center_cost) || cardEntityMap.has(t.center_cost);
        })
        .map((t: any): CardInvoiceTransaction => {
          const mappedCard = CENTER_COST_CARD_MAP[t.center_cost];
          const mappedEntity = CENTER_COST_ENTITY_MAP[t.center_cost];
          const dynamicEntity = cardEntityMap.get(t.center_cost) ?? null;
          return {
            id: t.id,
            description: t.description,
            amount: Math.abs(t.amount),
            competence_date: t.competence_date,
            due_date: t.due_date,
            status: t.status,
            center_cost: t.center_cost,
            card_name: mappedCard || t.center_cost,
            entity_type: mappedEntity || dynamicEntity,
            cycle_month: t.due_date
              ? cardCycleMonthOf(t.due_date, cardDueDayMap.get(t.center_cost))
              : t.competence_date.substring(0, 7),
            card_id: cardIdMap.get(t.center_cost) ?? null,
            card_due_day: cardDueDayMap.get(t.center_cost) ?? null,
            source: cardIdMap.has(t.center_cost) ? "transactions" : "legacy",
          };
        });

      // Source 2: card_installments from card_purchases
      let fromInstallments: CardInvoiceTransaction[] = [];
      try {
        const { data: instData, error: instError } = await (supabase as any)
          .from("card_installments")
          .select("id, billing_month, due_date, amount, status, card_purchases(description, card_id, cards(name, due_day), financial_entities(entity_type))")
          .order("due_date", { ascending: false })
          .limit(10000);

        if (!instError && instData) {
          fromInstallments = (instData as any[])
            .filter((inst) => inst.status !== "cancelled")
            .map((inst): CardInvoiceTransaction => {
            const cardName = inst.card_purchases?.cards?.name || "—";
            const entityRaw = inst.card_purchases?.financial_entities?.entity_type;
            const entityType: "personal" | "business" | null =
              entityRaw === "personal" || entityRaw === "business" ? entityRaw : null;
            const statusMapped = inst.status === "paid" ? "paid" : "planned";

            return {
              id: inst.id,
              description: inst.card_purchases?.description || "",
              amount: Math.abs(inst.amount),
              competence_date: inst.billing_month + "-01",
              due_date: inst.due_date,
              status: statusMapped,
              center_cost: "",
              card_name: cardName,
              entity_type: entityType,
              cycle_month: String(inst.billing_month).substring(0, 7),
              card_id: inst.card_purchases?.card_id ?? null,
              card_due_day: inst.card_purchases?.cards?.due_day ?? null,
              source: "installments",
            };
          });
        }
      } catch {
        // card_installments table may not exist — ignore
      }

      // Deduplicate: installment IDs won't collide with transaction IDs (both UUIDs)
      const seenIds = new Set(fromTransactions.map((t) => t.id));
      const unique = fromInstallments.filter((i) => !seenIds.has(i.id));

      return [...fromTransactions, ...unique];
    },
  });
}

/** Total faturado por cartão (para barras de progresso) — filtrado por mês */
export function useCardInvoicesByCard(filterMonth?: string) {
  const { data: invoices = [], ...rest } = useCardInvoiceTransactionsQuery();

  const byCard = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((i) => {
        // Filter by month if provided (compare YYYY-MM from competence_date)
        if (filterMonth && filterMonth !== "all") {
          const invMonth = i.competence_date.substring(0, 7);
          if (invMonth !== filterMonth) return false;
        }
        return true;
      })
      .forEach((i) => {
        map.set(i.card_name, (map.get(i.card_name) || 0) + i.amount);
      });
    return map;
  }, [invoices, filterMonth]);

  return { byCard, ...rest };
}

/** Resumo por cartão: totais histórico/futuro, paid/planned, contagem */
export function useCardInvoiceSummaryByCard() {
  const { data: invoices = [], ...rest } = useCardInvoiceTransactionsQuery();

  const summaries = useMemo(() => {
    const map = new Map<string, CardInvoiceSummary>();

    invoices.forEach((inv) => {
      let summary = map.get(inv.card_name);
      if (!summary) {
        summary = {
          card_name: inv.card_name,
          entity_type: inv.entity_type,
          paidTotal: 0,
          plannedTotal: 0,
          historicalTotal: 0,
          projectedTotal: 0,
          count: 0,
        };
        map.set(inv.card_name, summary);
      }

      summary.count += 1;

      // By DB status
      if (inv.status === "paid") summary.paidTotal += inv.amount;
      if (inv.status === "planned") summary.plannedTotal += inv.amount;

      // By temporal UX rule (without overwriting DB status)
      if (inv.competence_date <= CUTOFF_DATE) {
        summary.historicalTotal += inv.amount;
      } else {
        summary.projectedTotal += inv.amount;
      }
    });

    return Array.from(map.values());
  }, [invoices]);

  return { summaries, ...rest };
}

/** Projeções de fatura agrupadas por mês e cartão */
export function useCardInvoiceProjections() {
  const { data: invoices = [], ...rest } = useCardInvoiceTransactionsQuery();

  const projections = useMemo(() => {
    const grouped = new Map<string, CardInvoiceProjection & { paid_amount: number; planned_amount: number }>();

    invoices.forEach((inv) => {
      const month = inv.cycle_month;
      const key = `${inv.card_name}_${month}`;
      const existing = grouped.get(key);

      if (existing) {
        if (inv.source === "transactions") existing.source = "transactions";
        existing.total_amount += inv.amount;
        existing.invoices_count += 1;
        if (inv.status === "paid") {
          existing.paid_amount += inv.amount;
        } else {
          existing.planned_amount += inv.amount;
        }
        // Status: if any planned, mark as mixed
        if (existing.paid_amount > 0 && existing.planned_amount > 0) {
          existing.status = "partial";
        } else if (existing.planned_amount > 0) {
          existing.status = "planned";
        }
      } else {
        const isPaid = inv.status === "paid";
        grouped.set(key, {
          card_name: inv.card_name,
          billing_month: month,
          // Vencimento da fatura = fim do ciclo do cartão (não o do primeiro item).
          due_date: inv.card_id ? cardCycleWindow(month, inv.card_due_day).end : inv.due_date,
          card_id: inv.card_id,
          card_due_day: inv.card_due_day,
          source: inv.source,
          total_amount: inv.amount,
          invoices_count: 1,
          status: inv.status,
          paid_amount: isPaid ? inv.amount : 0,
          planned_amount: isPaid ? 0 : inv.amount,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.billing_month.localeCompare(b.billing_month) || a.card_name.localeCompare(b.card_name)
    );
  }, [invoices]);

  return { projections, ...rest };
}
