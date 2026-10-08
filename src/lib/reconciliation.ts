// Conciliação bancária (CON-02) pela regra oficial de saldo (regras-saldo-bancario.md):
// saldo = abertura + lançamentos "paid" com data efetiva posterior à data-base da conta.
// Data efetiva = coalesce(payment_date, competence_date, due_date).

export interface ReconTransaction {
  id: string;
  description: string;
  amount: number;
  transaction_type: string; // income | expense
  status: string;
  payment_date: string | null;
  competence_date: string | null;
  due_date: string | null;
  center_cost?: string | null;
  payee?: string | null;
  category?: string | null;
}

export interface ReconAccount {
  id: string;
  name: string;
  opening_balance: number;
  opening_balance_date: string | null;
  current_balance: number;
}

export interface ReconLine extends ReconTransaction {
  effective_date: string;
  signed: number;
  running_balance: number;
}

export interface MonthReconciliation {
  month: string;              // yyyy-MM
  monthStart: string;         // yyyy-MM-01
  monthEnd: string;           // último dia
  beforeOpening: boolean;     // mês inteiro anterior/igual à data-base
  startBalance: number;       // saldo no início do mês (fim do dia anterior)
  inflow: number;
  outflow: number;
  endBalance: number;
  lines: ReconLine[];
  planned: ReconTransaction[]; // previstos do mês (não afetam o saldo)
  plannedTotal: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function effectiveDate(t: Pick<ReconTransaction, "payment_date" | "competence_date" | "due_date">): string | null {
  return (t.payment_date || t.competence_date || t.due_date || null)?.slice(0, 10) ?? null;
}

export function signedAmount(t: Pick<ReconTransaction, "amount" | "transaction_type">): number {
  const v = Number(t.amount) || 0;
  if (t.transaction_type === "income") return v;
  if (t.transaction_type === "expense") return -v;
  return 0;
}

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Considera só o que entra na regra oficial: paid e data efetiva > data-base. */
function counts(t: ReconTransaction, base: string): string | null {
  if (t.status !== "paid") return null;
  const ed = effectiveDate(t);
  if (!ed || ed <= base) return null;
  return ed;
}

export function reconcileMonth(account: ReconAccount, txs: ReconTransaction[], month: string): MonthReconciliation {
  const { start, end } = monthBounds(month);
  const base = (account.opening_balance_date || "1900-01-01").slice(0, 10);
  const opening = Number(account.opening_balance) || 0;

  let before = 0;
  const inMonth: ReconLine[] = [];
  for (const t of txs) {
    const ed = counts(t, base);
    if (!ed) continue;
    const s = signedAmount(t);
    if (ed < start) before += s;
    else if (ed <= end) inMonth.push({ ...t, effective_date: ed, signed: s, running_balance: 0 });
  }
  inMonth.sort((a, b) => a.effective_date.localeCompare(b.effective_date) || b.signed - a.signed || a.description.localeCompare(b.description));

  const startBalance = round2(opening + before);
  let run = startBalance, inflow = 0, outflow = 0;
  for (const l of inMonth) {
    run = round2(run + l.signed);
    l.running_balance = run;
    if (l.signed >= 0) inflow += l.signed; else outflow += -l.signed;
  }

  const planned = txs
    .filter((t) => t.status === "planned")
    .filter((t) => { const d = (t.due_date || t.competence_date || "").slice(0, 10); return d >= start && d <= end; })
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));

  return {
    month, monthStart: start, monthEnd: end,
    beforeOpening: end <= base,
    startBalance,
    inflow: round2(inflow),
    outflow: round2(outflow),
    endBalance: round2(run),
    lines: inMonth,
    planned,
    plannedTotal: round2(planned.reduce((s, t) => s + signedAmount(t), 0)),
  };
}

/** Saldo pela regra oficial considerando tudo até hoje (deve bater com current_balance). */
export function officialBalance(account: ReconAccount, txs: ReconTransaction[]): number {
  const base = (account.opening_balance_date || "1900-01-01").slice(0, 10);
  let s = Number(account.opening_balance) || 0;
  for (const t of txs) if (counts(t, base)) s += signedAmount(t);
  return round2(s);
}

/** CSV (separador ;, decimal com vírgula) para abrir no Excel em pt-BR. */
export function reconciliationCsv(accountName: string, r: MonthReconciliation): string {
  const n = (v: number) => v.toFixed(2).replace(".", ",");
  const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Conta", accountName], ["Mês", r.month],
    ["Saldo inicial", n(r.startBalance)], ["Entradas", n(r.inflow)], ["Saídas", n(r.outflow)], ["Saldo final", n(r.endBalance)],
    [],
    ["Data efetiva", "Descrição", "Categoria", "Centro de custo", "Valor", "Saldo após"],
    ...r.lines.map((l) => [l.effective_date, l.description, l.category || "", l.center_cost || "", n(l.signed), n(l.running_balance)]),
  ];
  return rows.map((r) => r.map((c) => esc(String(c))).join(";")).join("\r\n");
}
