// Motor de conciliação: compara as linhas do extrato com os lançamentos da conta no app e
// propõe ajustes. Nada é aplicado aqui; o usuário aprova e a função do banco aplica.
import type { StatementLine } from "@/lib/statementParsers";

export interface AppTx {
  id: string;
  description: string;
  amount: number;
  transaction_type: string;
  status: string;
  payment_date: string | null;
  competence_date: string | null;
  due_date: string | null;
  center_cost?: string | null;
  account_id?: string | null;
}

export interface MatchRule {
  id?: string;
  pattern: string;
  description: string;
  category_id: string | null;
  transaction_type: "income" | "expense";
}

export type SuggestionKind = "create" | "settle" | "update_amount" | "cancel" | "ignore";

export interface BankItem {
  key: string;            // índice estável da linha do extrato
  line: StatementLine;
  status: "matched" | "group" | "near" | "planned" | "missing" | "internal" | "invoice";
  appIds: string[];       // lançamentos do app associados
  appAmount?: number;     // valor no app (valor diferente) ou soma dos itens do cartão (fatura)
  plannedId?: string;     // previsto sugerido para baixa
  rule?: MatchRule;
  suggestion?: SuggestionKind;
}

export interface AppOnlyItem {
  tx: AppTx;
  signed: number;
  date: string;
}

export interface MatchResult {
  bank: BankItem[];
  appOnly: AppOnlyItem[];
  matchedCount: number;
  groupCount: number;
  bankTotal: number;      // soma das linhas do extrato (sem as internas)
  appTotal: number;       // soma dos lançamentos pagos do app na janela
}

export interface MatchOptions {
  dateTolerance?: number;      // dias para 1:1 (padrão 5)
  groupTolerance?: number;     // dias para grupos (padrão 3)
  plannedTolerance?: number;   // dias para baixar previsto (padrão 10)
  internalPattern?: RegExp;    // movimentos internos (ex.: caixinha / RDB)
  invoicePattern?: RegExp;     // pagamento de fatura de cartão
  invoiceTolerance?: number;   // dias em torno do pagamento para juntar os itens do cartão (padrão 10)
}

export const DEFAULT_INTERNAL = /\b(aplica[cç][aã]o|resgate)\s+rdb\b|\brdb\b/i;
export const DEFAULT_INVOICE = /fatura|cart[aã]o\s+de\s+cr[eé]dito/i;

const cents = (n: number) => Math.round(n * 100);
const round2 = (n: number) => Math.round(n * 100) / 100;

const shift = (iso: string, d: number) => new Date(Date.parse(iso + "T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);

export function appEffectiveDate(t: Pick<AppTx, "payment_date" | "competence_date" | "due_date">): string {
  return (t.payment_date || t.competence_date || t.due_date || "").slice(0, 10);
}

export function appSigned(t: Pick<AppTx, "amount" | "transaction_type">): number {
  const v = Math.abs(Number(t.amount) || 0);
  if (t.transaction_type === "income") return v;
  if (t.transaction_type === "expense") return -v;
  return 0;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
}

export function findRule(memo: string, rules: MatchRule[]): MatchRule | undefined {
  const m = memo.toLowerCase();
  return rules
    .filter((r) => r.pattern && m.includes(r.pattern.toLowerCase()))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
}

/** Procura uma combinação de até `maxSize` valores (em centavos) que some `target`. */
function subsetSum(items: { idx: number; v: number }[], target: number, maxSize: number): number[] | null {
  const sorted = [...items].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 16);
  const pick: number[] = [];
  const dfs = (start: number, rest: number): boolean => {
    if (rest === 0 && pick.length >= 2) return true;
    if (pick.length >= maxSize) return false;
    for (let i = start; i < sorted.length; i++) {
      const v = sorted[i].v;
      if (Math.sign(v) !== Math.sign(target) || Math.abs(v) > Math.abs(rest)) continue;
      pick.push(sorted[i].idx);
      if (dfs(i + 1, rest - v)) return true;
      pick.pop();
    }
    return false;
  };
  return dfs(0, target) ? [...pick] : null;
}

/**
 * paid: lançamentos pagos da conta (qualquer data; o motor filtra pela janela do extrato).
 * planned: previstos da conta ou sem conta, para sugerir baixa.
 */
export function matchStatement(
  lines: StatementLine[],
  paid: AppTx[],
  planned: AppTx[],
  rules: MatchRule[] = [],
  opts: MatchOptions = {},
): MatchResult {
  const tol = opts.dateTolerance ?? 5;
  const gtol = opts.groupTolerance ?? 3;
  const ptol = opts.plannedTolerance ?? 10;
  const internal = opts.internalPattern ?? DEFAULT_INTERNAL;
  const invoice = opts.invoicePattern ?? DEFAULT_INVOICE;
  const itol = opts.invoiceTolerance ?? 10;

  if (lines.length === 0) return { bank: [], appOnly: [], matchedCount: 0, groupCount: 0, bankTotal: 0, appTotal: 0 };
  const first = lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date);
  const last = lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date);

  const app = paid
    .map((tx) => ({ tx, signed: appSigned(tx), date: appEffectiveDate(tx), card: !!tx.center_cost }))
    // itens de cartão entram com folga: a data do item é o vencimento da fatura, não o débito na conta
    .filter((a) => a.signed !== 0 && a.date && (a.card
      ? a.date >= shift(first, -itol) && a.date <= shift(last, itol)
      : a.date >= first && a.date <= last));
  const used = new Set<number>();

  const bank: BankItem[] = lines.map((line, i) => ({
    key: String(i),
    line,
    status: internal.test(line.memo) ? "internal" : "missing",
    appIds: [],
  }));

  // 1. Um para um: mesmo valor, data mais próxima dentro da tolerância
  for (const b of bank) {
    if (b.status !== "missing") continue;
    let best = -1;
    let bestDiff = Infinity;
    app.forEach((a, i) => {
      if (used.has(i) || a.card || cents(a.signed) !== cents(b.line.amount)) return;
      const d = Math.abs(daysBetween(a.date, b.line.date));
      if (d <= tol && d < bestDiff) { best = i; bestDiff = d; }
    });
    if (best >= 0) { used.add(best); b.status = "matched"; b.appIds = [app[best].tx.id]; }
  }

  // 2. Vários do app para uma linha do extrato (ex.: 4 itens de limpeza = 1 Pix)
  for (const b of bank) {
    if (b.status !== "missing") continue;
    const cand = app
      .map((a, idx) => ({ a, idx }))
      .filter(({ a, idx }) => !used.has(idx) && !a.card && Math.abs(daysBetween(a.date, b.line.date)) <= gtol)
      .map(({ a, idx }) => ({ idx, v: cents(a.signed) }));
    const combo = subsetSum(cand, cents(b.line.amount), 6);
    if (combo) { combo.forEach((i) => used.add(i)); b.status = "group"; b.appIds = combo.map((i) => app[i].tx.id); }
  }

  // 3. Uma do app para várias do extrato (ex.: empréstimo 1.800 = 1.750 + 50)
  app.forEach((a, ai) => {
    if (used.has(ai) || a.card) return;
    const cand = bank
      .map((b, idx) => ({ b, idx }))
      .filter(({ b }) => b.status === "missing" && Math.abs(daysBetween(a.date, b.line.date)) <= gtol)
      .map(({ b, idx }) => ({ idx, v: cents(b.line.amount) }));
    const combo = subsetSum(cand, cents(a.signed), 4);
    if (combo) {
      used.add(ai);
      combo.forEach((bi) => { bank[bi].status = "group"; bank[bi].appIds = [a.tx.id]; });
    }
  });

  // 3b. Pagamento de fatura: os itens do cartão já estão no app, um a um. Junta os itens de cartão
  //     ainda sem par em torno da data e mostra a diferença; nunca sugere lançar o pagamento.
  for (const b of bank) {
    if (b.status !== "missing" || b.line.amount >= 0) continue;
    const near = app
      .map((a, idx) => ({ a, idx }))
      .filter(({ a, idx }) => !used.has(idx) && a.tx.center_cost && a.signed < 0 && Math.abs(daysBetween(a.date, b.line.date)) <= itol);
    const total = round2(near.reduce((s, x) => s + x.a.signed, 0));
    const close = near.length > 0 && Math.abs(total - b.line.amount) <= Math.max(1, Math.abs(b.line.amount) * 0.05);
    if (invoice.test(b.line.memo) || close) {
      near.forEach(({ idx }) => used.add(idx));
      b.status = "invoice";
      b.appIds = near.map(({ a }) => a.tx.id);
      b.appAmount = total;
      b.suggestion = "ignore";
    }
  }

  // 4. Valor diferente: mesma data (±gtol), mesmo sinal, diferença até R$ 1 ou 1%
  for (const b of bank) {
    if (b.status !== "missing") continue;
    let best = -1;
    let bestDiff = Infinity;
    app.forEach((a, i) => {
      if (used.has(i) || a.card || Math.sign(a.signed) !== Math.sign(b.line.amount)) return;
      if (Math.abs(daysBetween(a.date, b.line.date)) > gtol) return;
      const diff = Math.abs(a.signed - b.line.amount);
      if (diff > 0 && diff <= Math.max(1, Math.abs(b.line.amount) * 0.01) && diff < bestDiff) { best = i; bestDiff = diff; }
    });
    if (best >= 0) {
      used.add(best);
      b.status = "near";
      b.appIds = [app[best].tx.id];
      b.appAmount = app[best].signed;
      b.suggestion = "update_amount";
    }
  }

  // 5. Previsto com o mesmo valor perto da data: sugerir baixa; senão, lançar
  const plannedUsed = new Set<string>();
  for (const b of bank) {
    if (b.status !== "missing") continue;
    const p = planned
      .filter((t) => !plannedUsed.has(t.id) && cents(appSigned(t)) === cents(b.line.amount))
      .map((t) => ({ t, d: Math.abs(daysBetween(t.due_date || t.competence_date || b.line.date, b.line.date)) }))
      .filter((x) => x.d <= ptol)
      .sort((x, y) => x.d - y.d)[0];
    if (p) { plannedUsed.add(p.t.id); b.status = "planned"; b.plannedId = p.t.id; b.suggestion = "settle"; continue; }
    b.rule = findRule(b.line.memo, rules);
    b.suggestion = "create";
  }
  for (const b of bank) if (b.status === "internal") b.suggestion = "ignore";

  const appOnly: AppOnlyItem[] = app.filter((_, i) => !used.has(i)).map((a) => ({ tx: a.tx, signed: a.signed, date: a.date }));

  return {
    bank,
    appOnly,
    matchedCount: bank.filter((b) => b.status === "matched").length,
    groupCount: bank.filter((b) => b.status === "group").length,
    bankTotal: round2(bank.filter((b) => b.status !== "internal").reduce((s, b) => s + b.line.amount, 0)),
    appTotal: round2(app.reduce((s, a) => s + a.signed, 0)),
  };
}

/** Descrição sugerida a partir do histórico do banco (sem CPF/CNPJ, agência e conta). */
export function suggestDescription(memo: string): string {
  return memo
    .replace(/\s*Agência:.*$/i, "")
    .replace(/\s*-\s*•+[\d.•-]*•*/g, "")
    .replace(/\s*-\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, "")
    .replace(/\s*-\s*(BCO|BANCO|ITAÚ|NU PAGAMENTOS|CAIXA|MERCADO PAGO|ASAAS|COOP)[^-]*/gi, "")
    .replace(/^(Transferência enviada pelo Pix|Transferência recebida pelo Pix|Compra no débito|Pagamento de boleto efetuado)\s*-\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 80) || "Lançamento do extrato";
}

/** Padrão curto para regra aprendida (primeiras palavras significativas do histórico). */
export function suggestPattern(memo: string): string {
  return suggestDescription(memo).split(/\s+/).slice(0, 3).join(" ").toLowerCase();
}

/** Efeito, no saldo do app, das sugestões aprovadas. */
export function approvedEffect(items: { kind: SuggestionKind; bankAmount: number; appAmount?: number; appSigned?: number }[]): number {
  return round2(items.reduce((s, i) => {
    if (i.kind === "create" || i.kind === "settle") return s + i.bankAmount;
    if (i.kind === "update_amount") return s + (i.bankAmount - (i.appAmount ?? 0));
    if (i.kind === "cancel") return s - (i.appSigned ?? 0);
    return s;
  }, 0));
}
