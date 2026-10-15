// cardCycle: agrupa itens de cartão pela fatura (ciclo), não pela data de cada item.
import { cardCycleMonthOf, cardCycleWindow } from "@/lib/cardCycle";

// Projeção de caixa de curto prazo (mês atual ou próximos), dia a dia e por conta.
// Funções puras: as consultas ficam em hooks/useMonthProjection.ts.
// Nada aqui altera dados; o simulador só recalcula em memória.

export interface ProjAccount {
  id: string;
  name: string;
  entityId: string;
  balance: number; // saldo atual (regra oficial)
}

export interface ProjTx {
  id: string;
  description: string;
  amount: number;          // sempre positivo
  type: "income" | "expense";
  entityId: string;
  accountId: string | null;
  categoryId: string | null;
  cardName: string | null; // center_cost: item de fatura de cartão
  date: string;            // vencimento (ou competência), yyyy-MM-dd
}

export interface ProjCategory {
  id: string;
  name: string;
  group: string | null;  // fixed | variable
  nature: string | null; // income | expense
}

export interface PaidExpense {
  categoryId: string | null;
  entityId: string;
  amount: number;
  date: string; // data efetiva: pagamento, competência ou vencimento
}

export interface ProjCard {
  name: string;
  entityId: string;
  managerialLimit: number;
  dueDay?: number | null;
}

export interface VariableEstimate {
  categoryId: string;
  name: string;
  average: number;   // valor típico mensal pago (mediana dos meses de referência)
  inMonth: number;   // já lançado (pago + previsto) no mês projetado
  gap: number;       // estimativa ainda não lançada = max(0, média − lançado)
  months: number;    // em quantos meses de referência a categoria apareceu
  largest?: number;  // maior lançamento único da categoria no mês
}

export interface Simulation {
  postponedTxIds?: string[];                 // despesas adiadas para depois do mês
  delayedIncomeIds?: string[];               // receitas que atrasam (teste de estresse)
  estimateCuts?: Record<string, number>;     // categoria → fração cortada (0 a 1)
}

export interface DayPoint {
  date: string;
  launched: number;      // saldo consolidado só com o que está lançado
  withEstimate: number;  // saldo consolidado com a estimativa de variáveis
  inMonth: boolean;
  inflow: number;        // entradas lançadas no dia
  outflow: number;       // saídas lançadas no dia
  events: { description: string; amount: number }[]; // maiores movimentos do dia (saída negativa)
}

export interface AccountProjection {
  id: string;
  name: string;
  entityId: string;
  current: number;
  start: number;     // saldo no início do mês projetado
  end: number;       // saldo no fim do mês projetado (lançado)
  min: number;       // menor saldo entre hoje e o fim do mês
  minDate: string;
  firstNegative: string | null;
  income: number;
  expense: number;
  monthMin: number;      // menor saldo dentro do mês projetado
  monthMinDate: string;
}

export interface InvoiceProjection {
  cardName: string;
  dueDate: string;
  total: number;
  count: number;
  managerialLimit: number;
  accounts: string[];
  topCategories: { name: string; total: number }[];
}

export interface MonthProjection {
  monthStart: string;
  monthEnd: string;
  startBalance: number;
  startWithEstimate: number; // saldo inicial descontando a estimativa dos meses anteriores
  income: number;
  expense: number;
  invoices: number;
  estimate: number;
  endLaunched: number;
  endWithEstimate: number;
  worstLaunched: { date: string; balance: number };
  worstWithEstimate: { date: string; balance: number };
  overdue: { count: number; net: number };
  days: DayPoint[];
  accounts: AccountProjection[];
  invoiceList: InvoiceProjection[];
  incomeList: ProjTx[];
  expenseList: ProjTx[]; // despesas fora de fatura no mês
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function monthBounds(ym: string): { start: string; end: string; days: number } {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(days)}`, days };
}

/** Meses (yyyy-MM) completos imediatamente anteriores ao mês de `today`. */
export function referenceMonths(today: string, count = 3): string[] {
  const [y, m] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
}

/**
 * Estimativa de gastos variáveis ainda não lançados no mês projetado:
 * média mensal paga por categoria variável nos meses de referência, menos o que já está lançado.
 * Só entra categoria que apareceu em pelo menos 2 dos meses (evita gasto pontual).
 */
export function variableEstimates(
  paid: PaidExpense[],
  inMonthByCategory: Record<string, number>,
  categories: ProjCategory[],
  refMonths: string[],
  largestByCategory: Record<string, number> = {},
): VariableEstimate[] {
  const variable = new Map(categories
    .filter((c) => c.group === "variable" && c.nature !== "income")
    .map((c) => [c.id, c]));
  const perCat = new Map<string, Map<string, number>>();
  for (const p of paid) {
    if (!p.categoryId || !variable.has(p.categoryId)) continue;
    const ym = p.date.slice(0, 7);
    if (!refMonths.includes(ym)) continue;
    const m = perCat.get(p.categoryId) ?? new Map<string, number>();
    m.set(ym, (m.get(ym) || 0) + Math.abs(p.amount));
    perCat.set(p.categoryId, m);
  }
  const out: VariableEstimate[] = [];
  perCat.forEach((byMonth, catId) => {
    if (byMonth.size < 2) return;
    // Mediana dos meses (mês sem gasto conta zero): um gasto pontual alto não infla a estimativa.
    const values = refMonths.map((m) => byMonth.get(m) || 0).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const average = r2(values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2);
    const inMonth = r2(inMonthByCategory[catId] || 0);
    out.push({
      categoryId: catId,
      name: variable.get(catId)!.name,
      average,
      inMonth,
      gap: r2(Math.max(0, average - inMonth)),
      months: byMonth.size,
      largest: r2(largestByCategory[catId] || 0),
    });
  });
  return out.sort((a, b) => b.gap - a.gap || b.average - a.average);
}

/**
 * Simula o caixa de hoje até o fim do mês projetado.
 * Previstos atrasados (data < hoje) entram hoje. Estimativas são distribuídas por igual nos dias do mês.
 */
export function projectMonth(args: {
  accounts: ProjAccount[];
  planned: ProjTx[];
  cards: ProjCard[];
  categories: ProjCategory[];
  /** Estimativa do mês projetado (atalho) ou de cada mês até ele (yyyy-MM → estimativas). */
  estimates?: VariableEstimate[];
  estimatesByMonth?: Record<string, VariableEstimate[]>;
  month: string; // yyyy-MM
  today: string;
  sim?: Simulation;
}): MonthProjection {
  const { accounts, planned, cards, categories, month, today } = args;
  const sim = args.sim ?? {};
  const { start: monthStart, end: monthEnd } = monthBounds(month);
  const estByMonth: Record<string, VariableEstimate[]> = args.estimatesByMonth ?? { [month]: args.estimates ?? [] };
  const postponed = new Set(sim.postponedTxIds ?? []);
  const delayed = new Set(sim.delayedIncomeIds ?? []);
  const cuts = sim.estimateCuts ?? {};
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const accIds = new Set(accounts.map((a) => a.id));

  // Lançamentos válidos até o fim do mês projetado.
  const effDate = (t: ProjTx) => (t.date < today ? today : t.date);
  const active = planned.filter((t) => {
    if (t.date > monthEnd) return false;
    if (t.type === "expense" && postponed.has(t.id)) return false;
    if (t.type === "income" && delayed.has(t.id)) return false;
    return true;
  });

  let overdueCount = 0, overdueNet = 0;
  for (const t of planned) {
    if (t.date < today) { overdueCount++; overdueNet += t.type === "income" ? t.amount : -t.amount; }
  }

  // Estimativa diária: cada mês até o projetado distribui a sua estimativa nos dias a partir de hoje.
  const estPlan = new Map<string, { perDay: number; firstDay: string; total: number }>();
  for (const [ym, list] of Object.entries(estByMonth)) {
    const b = monthBounds(ym);
    if (b.end < today || b.start > monthEnd) continue;
    const total = r2(list.reduce((s, e) => s + e.gap * (1 - Math.min(1, Math.max(0, cuts[e.categoryId] ?? 0))), 0));
    const firstDay = b.start < today ? today : b.start;
    const nDays = b.days - (Number(firstDay.slice(8)) - 1);
    estPlan.set(ym, { perDay: nDays > 0 ? total / nDays : 0, firstDay, total });
  }
  const estTotal = estPlan.get(month)?.total ?? 0;

  // Movimento por dia e por conta.
  const byDay = new Map<string, Map<string, number>>();
  const flows = new Map<string, { inflow: number; outflow: number; events: { description: string; amount: number }[] }>();
  for (const t of active) {
    const d = effDate(t);
    const f = flows.get(d) ?? { inflow: 0, outflow: 0, events: [] };
    if (t.type === "income") f.inflow += t.amount; else f.outflow += t.amount;
    f.events.push({ description: t.cardName ? `Cartão ${t.cardName}` : t.description, amount: t.type === "income" ? t.amount : -t.amount });
    flows.set(d, f);
    const key = t.accountId && accIds.has(t.accountId) ? t.accountId : "__sem_conta";
    const m = byDay.get(d) ?? new Map<string, number>();
    m.set(key, (m.get(key) || 0) + (t.type === "income" ? t.amount : -t.amount));
    byDay.set(d, m);
  }

  const bal = new Map<string, number>(accounts.map((a) => [a.id, Number(a.balance) || 0]));
  bal.set("__sem_conta", 0);
  const acc: Record<string, AccountProjection> = {};
  for (const a of accounts) {
    acc[a.id] = { id: a.id, name: a.name, entityId: a.entityId, current: r2(Number(a.balance) || 0), start: 0, end: 0,
      min: Number(a.balance) || 0, minDate: today, firstNegative: (Number(a.balance) || 0) < 0 ? today : null, income: 0, expense: 0,
      monthMin: Number.POSITIVE_INFINITY, monthMinDate: monthStart };
  }

  const days: DayPoint[] = [];
  let estAcc = 0;
  const total = () => { let s = 0; bal.forEach((v) => { s += v; }); return s; };
  // Mês em curso: começa no saldo de hoje. Mês futuro: saldo no fim da véspera do dia 1.
  let startBalance = r2(total());
  let startWithEstimate = startBalance;
  const futureMonth = monthStart > today;
  const eve = addDaysIso(monthStart, -1);

  for (let d = today; d <= monthEnd; d = addDaysIso(d, 1)) {
    const mv = byDay.get(d);
    mv?.forEach((v, k) => bal.set(k, (bal.get(k) || 0) + v));
    const inMonth = d >= monthStart;
    const ep = estPlan.get(d.slice(0, 7));
    if (ep && d >= ep.firstDay) estAcc += ep.perDay;
    for (const a of accounts) {
      const b = bal.get(a.id) || 0;
      if (b < acc[a.id].min - 0.004) { acc[a.id].min = b; acc[a.id].minDate = d; }
      if (b < -0.004 && !acc[a.id].firstNegative) acc[a.id].firstNegative = d;
      if (futureMonth && d === eve) acc[a.id].start = r2(b);
      if (inMonth && b < acc[a.id].monthMin - 0.004) { acc[a.id].monthMin = b; acc[a.id].monthMinDate = d; }
    }
    const t = total();
    if (futureMonth && d === eve) { startBalance = r2(t); startWithEstimate = r2(t - estAcc); }
    const f = flows.get(d);
    const events = f ? mergeEvents(f.events) : [];
    days.push({ date: d, launched: r2(t), withEstimate: r2(t - estAcc), inMonth,
      inflow: r2(f?.inflow ?? 0), outflow: r2(f?.outflow ?? 0), events });
  }
  for (const a of accounts) {
    if (!futureMonth) acc[a.id].start = acc[a.id].current;
    acc[a.id].end = r2(bal.get(a.id) || 0);
    acc[a.id].min = r2(acc[a.id].min);
    acc[a.id].monthMin = Number.isFinite(acc[a.id].monthMin) ? r2(acc[a.id].monthMin) : acc[a.id].end;
  }

  // Totais do mês projetado (só o que vence dentro do mês; atrasados contam no mês atual).
  const inMonthTx = active.filter((t) => effDate(t) >= monthStart && effDate(t) <= monthEnd);
  let income = 0, expense = 0, invoices = 0;
  for (const t of inMonthTx) {
    if (t.type === "income") income += t.amount; else { expense += t.amount; if (t.cardName) invoices += t.amount; }
    if (t.accountId && acc[t.accountId]) {
      if (t.type === "income") acc[t.accountId].income += t.amount; else acc[t.accountId].expense += t.amount;
    }
  }
  Object.values(acc).forEach((a) => { a.income = r2(a.income); a.expense = r2(a.expense); });

  // Faturas: itens de cartão do mês agrupados por cartão e vencimento (inclui adiados? não: só ativos).
  const cardMap = new Map(cards.map((c) => [c.name, c]));
  const inv = new Map<string, { cardName: string; dueDate: string; total: number; count: number; accounts: Set<string>; cats: Map<string, number> }>();
  for (const t of inMonthTx) {
    if (t.type !== "expense" || !t.cardName) continue;
    const card = cardMap.get(t.cardName);
    const due = card ? cardCycleWindow(cardCycleMonthOf(t.date, card.dueDay), card.dueDay).end : t.date;
    const k = `${t.cardName}|${due}`;
    const g = inv.get(k) ?? { cardName: t.cardName, dueDate: due, total: 0, count: 0, accounts: new Set<string>(), cats: new Map<string, number>() };
    g.total += t.amount; g.count++;
    if (t.accountId) g.accounts.add(accName.get(t.accountId) || "—");
    const cn = (t.categoryId && catName.get(t.categoryId)) || "Sem categoria";
    g.cats.set(cn, (g.cats.get(cn) || 0) + t.amount);
    inv.set(k, g);
  }
  const invoiceList: InvoiceProjection[] = Array.from(inv.values()).map((g) => ({
    cardName: g.cardName,
    dueDate: g.dueDate,
    total: r2(g.total),
    count: g.count,
    managerialLimit: cardMap.get(g.cardName)?.managerialLimit || 0,
    accounts: Array.from(g.accounts),
    topCategories: Array.from(g.cats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, total]) => ({ name, total: r2(total) })),
  })).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.total - a.total);

  const monthPoints = days.filter((p) => p.inMonth);
  const worstOf = (key: "launched" | "withEstimate") => monthPoints.reduce(
    (w, p) => (p[key] < w.balance ? { date: p.date, balance: p[key] } : w),
    { date: monthPoints[0]?.date ?? monthStart, balance: monthPoints[0]?.[key] ?? startBalance },
  );

  const last = days[days.length - 1];
  return {
    monthStart,
    monthEnd,
    startBalance,
    startWithEstimate,
    income: r2(income),
    expense: r2(expense),
    invoices: r2(invoices),
    estimate: estTotal,
    endLaunched: last ? last.launched : startBalance,
    endWithEstimate: last ? last.withEstimate : startBalance,
    worstLaunched: worstOf("launched"),
    worstWithEstimate: worstOf("withEstimate"),
    overdue: { count: overdueCount, net: r2(overdueNet) },
    days,
    accounts: Object.values(acc).sort((a, b) => a.min - b.min),
    invoiceList,
    incomeList: inMonthTx.filter((t) => t.type === "income").sort((a, b) => b.amount - a.amount),
    expenseList: inMonthTx.filter((t) => t.type === "expense" && !t.cardName).sort((a, b) => b.amount - a.amount),
  };
}

// ---------------------------------------------------------------------------
// Ações sugeridas (regras simples sobre os próprios dados).

export type SuggestionLevel = "critical" | "warning" | "info" | "positive";

export interface Suggestion {
  id: string;
  level: SuggestionLevel;
  title: string;
  detail: string;
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function suggestActions(args: {
  projection: MonthProjection;
  planned: ProjTx[];
  estimates: VariableEstimate[];
  entityType: (entityId: string) => string | null; // personal | business
  today: string;
  avgIncome?: number;      // média mensal recebida nos meses de referência
  useEstimate?: boolean;   // decisões com a estimativa de variáveis (padrão: só lançado)
}): Suggestion[] {
  const { projection: p, estimates, entityType } = args;
  const worst = args.useEstimate ? p.worstWithEstimate : p.worstLaunched;
  const end = args.useEstimate ? p.endWithEstimate : p.endLaunched;
  const out: Suggestion[] = [];

  // 1. Caixa somando as contas: pior dia ou fechamento negativo.
  if (worst.balance < -0.5) {
    const outs = p.days.filter((d) => d.inMonth && d.date <= worst.date)
      .flatMap((d) => d.events.filter((e) => e.amount < 0).map((e) => ({ ...e, date: d.date })))
      .sort((x, y) => x.amount - y.amount);
    const ins = p.incomeList.filter((t) => t.date > worst.date);
    const parts: string[] = [];
    if (outs[0]) parts.push(`Maior saída antes: ${outs[0].description} ${brl(-outs[0].amount)} (${br(outs[0].date)}).`);
    if (ins[0]) parts.push(`Maior entrada depois: ${ins[0].description} ${brl(ins[0].amount)} (${br(ins[0].date)}): antecipar ou mudar datas resolve o descasamento.`);
    else parts.push("Não há entradas previstas depois desse dia: será preciso cortar, adiar ou renegociar.");
    out.push({ id: "cash", level: "critical", title: `Faltam ${brl(-worst.balance)} no pior dia (${br(worst.date)})`, detail: parts.join(" ") });
  } else if (end < -0.5) {
    out.push({ id: "cash", level: "critical", title: `O mês fecha em ${brl(end)}`, detail: "Use o simulador para escolher o que adiar ou reduzir." });
  }

  // 2. Contas que ficam negativas dentro do mês, com transferências possíveis entre contas com folga.
  const negs = p.accounts.filter((a) => a.monthMin < -0.5).sort((x, y) => x.monthMin - y.monthMin);
  if (negs.length) {
    const capacity = new Map(p.accounts.filter((a) => Math.min(a.min, a.monthMin) > 50).map((a) => [a.id, Math.min(a.min, a.monthMin)]));
    const moves: string[] = [];
    let cross = false;
    for (const a of negs) {
      const need = r2(-a.monthMin);
      const donor = p.accounts
        .filter((o) => o.id !== a.id && (capacity.get(o.id) ?? 0) >= need)
        .sort((x, y) => Number(y.entityId === a.entityId) - Number(x.entityId === a.entityId) || (capacity.get(y.id)! - capacity.get(x.id)!))[0];
      if (!donor) continue;
      capacity.set(donor.id, capacity.get(donor.id)! - need);
      if (donor.entityId !== a.entityId && entityType(donor.entityId) !== entityType(a.entityId)) cross = true;
      moves.push(`${donor.name} → ${a.name} ${brl(need)} até ${br(a.monthMinDate)}`);
    }
    const list = negs.slice(0, 3).map((a) => `${a.name} ${brl(a.monthMin)} (${br(a.monthMinDate)})`).join("; ");
    out.push({
      id: "accounts",
      level: "warning",
      title: `${negs.length} conta(s) ficam negativas no mês`,
      detail: `${list}${negs.length > 3 ? ` e mais ${negs.length - 3}` : ""}. `
        + (moves.length ? `Transferências que cobrem: ${moves.join("; ")}.${cross ? " Entre PF e PJ, registre conforme orientação do contador." : ""}` : "Nenhuma conta tem folga para cobrir; ver o caixa total acima."),
    });
  }

  // 3. Faturas acima do teto gerencial.
  const over = p.invoiceList.filter((f) => f.managerialLimit > 0 && f.total > f.managerialLimit);
  if (over.length) {
    out.push({
      id: "cards",
      level: "warning",
      title: `${over.length} fatura(s) acima do teto`,
      detail: over.map((f) => `${f.cardName} ${brl(f.total)} (+${brl(r2(f.total - f.managerialLimit))})`).join("; ") + ". Segure novas compras nesses cartões até o fechamento.",
    });
  }

  // 4. Receitas lançadas bem abaixo do que costuma entrar.
  if (args.avgIncome && args.avgIncome > 0 && p.income < args.avgIncome * 0.5) {
    out.push({
      id: "low-income",
      level: "warning",
      title: `Receitas lançadas (${brl(p.income)}) bem abaixo da média recebida (${brl(args.avgIncome)})`,
      detail: "Lance os recebimentos esperados (ou crie recorrências); sem isso a projeção fica pessimista.",
    });
  }

  // 5. Categorias variáveis acima do valor típico (sem contar lançamento único grande).
  const high = estimates
    .filter((e) => !((e.largest ?? 0) > e.inMonth * 0.7) && e.average > 0 && e.inMonth > e.average * 1.3 && e.inMonth - e.average >= 200)
    .sort((x, y) => (y.inMonth - y.average) - (x.inMonth - x.average));
  if (high.length) {
    const free = r2(high.reduce((s, e) => s + e.inMonth - e.average, 0));
    out.push({
      id: "categories",
      level: "info",
      title: `Gastos acima do habitual: voltar ao típico libera ${brl(free)}`,
      detail: high.slice(0, 3).map((e) => `${e.name} ${brl(e.inMonth)} (típico ${brl(e.average)})`).join("; ") + ".",
    });
  }

  // 6. Previstos vencidos.
  if (p.overdue.count > 0) {
    out.push({
      id: "overdue",
      level: "info",
      title: `${p.overdue.count} previsto(s) já vencido(s)`,
      detail: "Entram como se fossem pagos hoje. Baixe em Lançamentos se já foram pagos, ou reagende.",
    });
  }

  // 7. Folga.
  if (worst.balance >= 0 && end > 0.5 && negs.length === 0) {
    out.push({
      id: "surplus",
      level: "positive",
      title: `Sobra prevista de ${brl(end)}`,
      detail: `Menor saldo do mês ${brl(worst.balance)} (${br(worst.date)}). Defina o destino antes de gastar: reserva e, havendo folga, amortizar a dívida mais cara.`,
    });
  }

  return out;
}

/**
 * Remove das despesas pagas as que têm uma receita paga de mesmo valor em até 3 dias
 * (transferência entre contas próprias): não são gasto e inflariam a estimativa.
 */
export function dropInternalTransfers<T extends { amount: number; date: string }>(expenses: T[], incomes: { amount: number; date: string }[]): T[] {
  const pool = incomes.map((i) => ({ amount: r2(i.amount), date: i.date, used: false }));
  return expenses.filter((e) => {
    const a = r2(e.amount);
    const m = pool.find((i) => !i.used && i.amount === a && Math.abs(daysBetween(i.date, e.date)) <= 3);
    if (m) { m.used = true; return false; }
    return true;
  });
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Recorrências: ocorrências futuras ainda não geradas como lançamento.

export interface ProjRecurrence {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  entityId: string;
  accountId: string | null;
  categoryId: string | null;
  cardName: string | null;
  frequency: string;        // monthly | weekly
  dueDay: number | null;
  dayOfWeek: number | null; // 0 = domingo
  startsOn: string;
  endsOn: string | null;
}

/**
 * Datas de cada recorrência entre `from` e `until` que ainda não existem como lançamento
 * (`existing` = "recurrenceId|yyyy-MM-dd" de qualquer status). Viram previstos virtuais.
 */
export function recurrenceOccurrences(recs: ProjRecurrence[], existing: Set<string>, from: string, until: string): ProjTx[] {
  const out: ProjTx[] = [];
  for (const r of recs) {
    const end = r.endsOn && r.endsOn < until ? r.endsOn : until;
    const begin = r.startsOn > from ? r.startsOn : from;
    if (begin > end) continue;
    const push = (date: string) => {
      if (date < begin || date > end || existing.has(`${r.id}|${date}`)) return;
      out.push({
        id: `rec:${r.id}:${date}`, description: `${r.description} (recorrência)`, amount: Math.abs(r.amount), type: r.type,
        entityId: r.entityId, accountId: r.accountId, categoryId: r.categoryId, cardName: r.cardName, date,
      });
    };
    if (r.frequency === "weekly") {
      const dow = r.dayOfWeek ?? new Date(`${r.startsOn}T12:00:00Z`).getUTCDay();
      let d = begin;
      while (new Date(`${d}T12:00:00Z`).getUTCDay() !== dow) d = addDaysIso(d, 1);
      for (; d <= end; d = addDaysIso(d, 7)) push(d);
    } else if (r.frequency === "monthly") {
      const day = r.dueDay ?? Number(r.startsOn.slice(8, 10));
      let [y, m] = begin.split("-").map(Number);
      for (;;) {
        const ym = `${y}-${pad(m)}`;
        if (`${ym}-01` > end) break;
        push(`${ym}-${pad(Math.min(day, monthBounds(ym).days))}`);
        m++; if (m > 12) { m = 1; y++; }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Visão de vários meses.

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  estimate: number;
  endLaunched: number;
  endWithEstimate: number;
  worst: { date: string; balance: number };        // com estimativa
  worstLaunched: { date: string; balance: number }; // só lançado
  lowIncome: boolean; // receitas lançadas bem abaixo da média recebida
}

export function projectHorizon(
  args: Omit<Parameters<typeof projectMonth>[0], "month">,
  months: string[],
  avgIncome: number,
): MonthSummary[] {
  return months.map((month) => {
    const p = projectMonth({ ...args, month });
    return {
      month,
      income: p.income,
      expense: p.expense,
      estimate: p.estimate,
      endLaunched: p.endLaunched,
      endWithEstimate: p.endWithEstimate,
      worst: p.worstWithEstimate,
      worstLaunched: p.worstLaunched,
      lowIncome: avgIncome > 0 && p.income < avgIncome * 0.5,
    };
  });
}

/** Junta movimentos de mesma descrição no dia e devolve os 4 maiores em valor absoluto. */
function mergeEvents(list: { description: string; amount: number }[]) {
  const m = new Map<string, number>();
  for (const e of list) m.set(e.description, (m.get(e.description) || 0) + e.amount);
  return Array.from(m.entries())
    .map(([description, amount]) => ({ description, amount: r2(amount) }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 4);
}
