// Cards do Dashboard: saldo previsto no fim do mês e limites dos cartões.
// Funções puras; as consultas ficam em hooks/useDashboardOutlook.ts.
import { cardCycleWindow } from "@/lib/cardCycle";

export interface OutlookAccount {
  name: string;
  current_balance: number;
  financial_entity_id: string;
}

export interface OutlookPendingTx {
  amount: number;
  transaction_type: string;
  financial_entity_id: string;
  due_date: string | null;
  competence_date: string | null;
}

export interface MonthOutlook {
  current: number;
  incomePlanned: number;
  expensePlanned: number;
  overdueCount: number;
  overdueNet: number;
  projected: number;
  negatives: { name: string; balance: number }[];
}

const isIncome = (t: string) => t === "income" || t === "receita";
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Saldo previsto no fim do mês = saldo atual das contas + receitas previstas − despesas previstas
 * com data até o fim do mês (inclui previstas atrasadas, que ainda vão sair/entrar).
 * Retorna null para meses já encerrados (o saldo atual não representa o passado).
 */
export function monthOutlook(
  accounts: OutlookAccount[],
  pending: OutlookPendingTx[],
  entityIds: string[] | null,
  monthEndExclusive: string, // yyyy-MM-01 do mês seguinte
  today: string, // yyyy-MM-dd
): MonthOutlook | null {
  if (monthEndExclusive <= today.slice(0, 8) + "01") return null;
  const inView = (id: string) => !entityIds || entityIds.includes(id);

  const acc = accounts.filter((a) => inView(a.financial_entity_id));
  const current = round2(acc.reduce((s, a) => s + Number(a.current_balance || 0), 0));
  const negatives = acc
    .filter((a) => Number(a.current_balance) < 0)
    .map((a) => ({ name: a.name, balance: Number(a.current_balance) }))
    .sort((a, b) => a.balance - b.balance);

  let incomePlanned = 0;
  let expensePlanned = 0;
  let overdueCount = 0;
  let overdueNet = 0;
  for (const t of pending) {
    if (!inView(t.financial_entity_id)) continue;
    const date = t.due_date ?? t.competence_date;
    if (!date || date >= monthEndExclusive) continue;
    const amt = Math.abs(Number(t.amount) || 0);
    const signed = isIncome(t.transaction_type) ? amt : -amt;
    if (signed > 0) incomePlanned += amt; else expensePlanned += amt;
    if (date < today) { overdueCount++; overdueNet += signed; }
  }

  return {
    current,
    incomePlanned: round2(incomePlanned),
    expensePlanned: round2(expensePlanned),
    overdueCount,
    overdueNet: round2(overdueNet),
    projected: round2(current + incomePlanned - expensePlanned),
    negatives,
  };
}

export interface LimitCard {
  name: string;
  entity_type: string | null;
  due_day: number | null;
  credit_limit: number | null;
  managerial_limit: number | null;
}

export interface LimitTx {
  center_cost: string;
  amount: number;
  status: string;
  due_date: string | null;
}

export type LimitLevel = "ok" | "attention" | "over" | "none";

export interface CardLimitRow {
  name: string;
  entity_type: string | null;
  cycleStart: string;
  cycleEnd: string;
  invoice: number;
  ceiling: number;
  margin: number | null;
  pct: number | null;
  level: LimitLevel;
  creditLimit: number;
  openTotal: number;
  available: number | null;
}

/**
 * Por cartão: fatura do mês x teto gerencial (margem do mês) e
 * limite do banco x total em aberto, inclusive parcelas futuras (limite disponível).
 */
export function cardLimits(cards: LimitCard[], txs: LimitTx[], referenceMonth: string): CardLimitRow[] {
  return cards
    .map((c) => {
      const { start, end } = cardCycleWindow(referenceMonth, c.due_day);
      const mine = txs.filter((t) => t.center_cost === c.name && t.status !== "cancelled");
      const invoice = round2(mine
        .filter((t) => t.due_date && t.due_date >= start && t.due_date <= end)
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0));
      const openTotal = round2(mine
        .filter((t) => t.status === "planned")
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0));
      const ceiling = Number(c.managerial_limit) || 0;
      const creditLimit = Number(c.credit_limit) || 0;
      const pct = ceiling > 0 ? invoice / ceiling : null;
      const level: LimitLevel = pct === null ? "none" : pct < 0.8 ? "ok" : pct <= 1 ? "attention" : "over";
      return {
        name: c.name,
        entity_type: c.entity_type,
        cycleStart: start,
        cycleEnd: end,
        invoice,
        ceiling,
        margin: ceiling > 0 ? round2(ceiling - invoice) : null,
        pct,
        level,
        creditLimit,
        openTotal,
        available: creditLimit > 0 ? round2(creditLimit - openTotal) : null,
      };
    })
    // Cartão sem teto, sem limite e sem uso não informa nada.
    .filter((r) => r.ceiling > 0 || r.creditLimit > 0 || r.invoice > 0 || r.openTotal > 0);
}
