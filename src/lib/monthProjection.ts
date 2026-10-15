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
}

export interface VariableEstimate {
  categoryId: string;
  name: string;
  average: number;   // média mensal paga nos meses de referência
  inMonth: number;   // já lançado (pago + previsto) no mês projetado
  gap: number;       // estimativa ainda não lançada = max(0, média − lançado)
  months: number;    // em quantos meses de referência a categoria apareceu
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
    let sum = 0;
    byMonth.forEach((v) => { sum += v; });
    const average = r2(sum / refMonths.length);
    const inMonth = r2(inMonthByCategory[catId] || 0);
    out.push({
      categoryId: catId,
      name: variable.get(catId)!.name,
      average,
      inMonth,
      gap: r2(Math.max(0, average - inMonth)),
      months: byMonth.size,
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
  estimates: VariableEstimate[];
  month: string; // yyyy-MM
  today: string;
  sim?: Simulation;
}): MonthProjection {
  const { accounts, planned, cards, categories, estimates, month, today } = args;
  const sim = args.sim ?? {};
  const { start: monthStart, end: monthEnd, days: monthDays } = monthBounds(month);
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

  // Estimativa diária (só no mês projetado e só nos dias a partir de hoje).
  const estTotal = r2(estimates.reduce((s, e) => s + e.gap * (1 - Math.min(1, Math.max(0, cuts[e.categoryId] ?? 0))), 0));
  const firstEstDay = monthStart < today ? today : monthStart;
  const estDays = monthEnd >= firstEstDay ? monthDays - (Number(firstEstDay.slice(8)) - 1) : 0;
  const estPerDay = estDays > 0 ? estTotal / estDays : 0;

  // Movimento por dia e por conta.
  const byDay = new Map<string, Map<string, number>>();
  for (const t of active) {
    const d = effDate(t);
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
      min: Number(a.balance) || 0, minDate: today, firstNegative: (Number(a.balance) || 0) < 0 ? today : null, income: 0, expense: 0 };
  }

  const days: DayPoint[] = [];
  let estAcc = 0;
  const total = () => { let s = 0; bal.forEach((v) => { s += v; }); return s; };
  // Mês em curso: começa no saldo de hoje. Mês futuro: saldo no fim da véspera do dia 1.
  let startBalance = r2(total());
  const futureMonth = monthStart > today;
  const eve = addDaysIso(monthStart, -1);

  for (let d = today; d <= monthEnd; d = addDaysIso(d, 1)) {
    const mv = byDay.get(d);
    mv?.forEach((v, k) => bal.set(k, (bal.get(k) || 0) + v));
    const inMonth = d >= monthStart;
    if (inMonth && d >= firstEstDay) estAcc += estPerDay;
    for (const a of accounts) {
      const b = bal.get(a.id) || 0;
      if (b < acc[a.id].min - 0.004) { acc[a.id].min = b; acc[a.id].minDate = d; }
      if (b < -0.004 && !acc[a.id].firstNegative) acc[a.id].firstNegative = d;
      if (futureMonth && d === eve) acc[a.id].start = r2(b);
    }
    const t = total();
    if (futureMonth && d === eve) startBalance = r2(t);
    days.push({ date: d, launched: r2(t), withEstimate: r2(t - estAcc), inMonth });
  }
  for (const a of accounts) {
    if (!futureMonth) acc[a.id].start = acc[a.id].current;
    acc[a.id].end = r2(bal.get(a.id) || 0);
    acc[a.id].min = r2(acc[a.id].min);
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
    const k = `${t.cardName}|${t.date}`;
    const g = inv.get(k) ?? { cardName: t.cardName, dueDate: effDate(t), total: 0, count: 0, accounts: new Set<string>(), cats: new Map<string, number>() };
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
}): Suggestion[] {
  const { projection: p, planned, estimates, entityType, today } = args;
  const out: Suggestion[] = [];

  // 1. Higiene: previstos atrasados distorcem a projeção.
  if (p.overdue.count > 0) {
    out.push({
      id: "overdue",
      level: "warning",
      title: `${p.overdue.count} lançamento(s) previstos já venceram`,
      detail: `Eles entram como se fossem pagos hoje (efeito líquido ${brl(p.overdue.net)}). Se já foram pagos ou recebidos, baixe em Lançamentos; se não, reagende para a data real.`,
    });
  }

  // 2. Contas que ficam negativas: transferência de outra conta ou adiamento.
  const negatives = p.accounts.filter((a) => a.min < -0.5);
  for (const a of negatives) {
    const need = r2(-a.min);
    const sameEntity = (o: AccountProjection) => o.entityId === a.entityId;
    const donors = p.accounts
      .filter((o) => o.id !== a.id && o.min > 50)
      .sort((x, y) => Number(sameEntity(y)) - Number(sameEntity(x)) || y.min - x.min);
    const full = donors.find((o) => o.min >= need);
    const when = a.firstNegative ?? a.minDate;
    if (full) {
      const cross = !sameEntity(full);
      out.push({
        id: `neg-${a.id}`,
        level: "critical",
        title: `${a.name} fica negativa a partir de ${br(when)} (pior: ${brl(a.min)} em ${br(a.minDate)})`,
        detail: `Transferir ${brl(need)} de ${full.name} até ${br(when)} cobre o buraco sem deixar ${full.name} negativa (fica com no mínimo ${brl(r2(full.min - need))}).`
          + (cross ? ` Atenção: é uma transferência entre ${entityLabel(entityType(full.entityId))} e ${entityLabel(entityType(a.entityId))}; registre como aporte, pró-labore, distribuição ou empréstimo, conforme orientação do seu contador.` : ""),
      });
    } else {
      const cands = planned
        .filter((t) => t.type === "expense" && !t.cardName && t.accountId === a.id && t.date >= today && t.date <= a.minDate)
        .sort((x, y) => y.amount - x.amount)
        .slice(0, 3);
      const partial = donors[0];
      out.push({
        id: `neg-${a.id}`,
        level: "critical",
        title: `${a.name} fica negativa a partir de ${br(when)} (pior: ${brl(a.min)} em ${br(a.minDate)})`,
        detail: (partial ? `Nenhuma conta cobre sozinha; ${partial.name} pode ceder até ${brl(r2(partial.min))}. ` : "Nenhuma outra conta tem folga para cobrir. ")
          + (cands.length ? `Candidatos a negociar data ou adiar: ${cands.map((t) => `${t.description} (${brl(t.amount)}, ${br(t.date)})`).join("; ")}.` : "Veja no simulador o que adiar ou antecipar."),
      });
    }
  }

  // 3. Caixa consolidado: pior dia do mês.
  const worst = p.worstWithEstimate;
  if (worst.balance < -0.5) {
    const before = planned.filter((t) => t.type === "expense" && !t.cardName && t.date >= p.monthStart && t.date <= worst.date)
      .sort((x, y) => y.amount - x.amount).slice(0, 3);
    const later = p.incomeList.filter((t) => t.date > worst.date).slice(0, 2);
    out.push({
      id: "worst",
      level: "critical",
      title: `Falta de caixa de ${brl(-worst.balance)} em ${br(worst.date)}, somando todas as contas`,
      detail: [
        before.length ? `Maiores saídas até essa data: ${before.map((t) => `${t.description} (${brl(t.amount)}, ${br(t.date)})`).join("; ")}.` : "",
        later.length ? `Receitas que chegam depois: ${later.map((t) => `${t.description} (${brl(t.amount)}, ${br(t.date)})`).join("; ")}; antecipar uma delas ou mudar o vencimento das saídas resolve o descasamento.` : "Sem receitas previstas depois desse dia: será preciso cortar, adiar ou renegociar.",
      ].filter(Boolean).join(" "),
    });
  } else if (p.endWithEstimate < -0.5) {
    out.push({
      id: "end-neg",
      level: "critical",
      title: `O mês fecha negativo em ${brl(p.endWithEstimate)} (com estimativa)`,
      detail: "Use o simulador para escolher o que adiar ou reduzir até o saldo final ficar positivo.",
    });
  }

  // 4. Faturas acima do teto gerencial.
  for (const f of p.invoiceList) {
    if (f.managerialLimit > 0 && f.total > f.managerialLimit) {
      out.push({
        id: `teto-${f.cardName}-${f.dueDate}`,
        level: "warning",
        title: `Fatura ${f.cardName} (${br(f.dueDate)}) passa do teto em ${brl(r2(f.total - f.managerialLimit))}`,
        detail: `Fatura de ${brl(f.total)} para teto de ${brl(f.managerialLimit)}. Mais pesaram: ${f.topCategories.map((c) => `${c.name} ${brl(c.total)}`).join(", ")}. Segure novas compras neste cartão até o fechamento.`,
      });
    }
  }

  // 5. Categorias variáveis já acima da média dos últimos meses.
  for (const e of estimates) {
    if (e.average > 0 && e.inMonth > e.average * 1.3 && e.inMonth - e.average >= 200) {
      out.push({
        id: `cat-${e.categoryId}`,
        level: "warning",
        title: `${e.name}: ${brl(e.inMonth)} lançados, ${Math.round((e.inMonth / e.average - 1) * 100)}% acima da média`,
        detail: `A média dos últimos meses é ${brl(e.average)}. Reduzir para a média libera ${brl(r2(e.inMonth - e.average))}.`,
      });
    }
  }

  // 6. Estimativa de variáveis.
  if (p.estimate > 0) {
    const top = estimates.filter((e) => e.gap > 0).slice(0, 3);
    out.push({
      id: "estimate",
      level: "info",
      title: `Gastos variáveis ainda não lançados: cerca de ${brl(p.estimate)}`,
      detail: `Pela média dos últimos 3 meses. Maiores: ${top.map((e) => `${e.name} ${brl(e.gap)}`).join(", ")}. Lançar uma previsão ou fixar um limite por categoria deixa a projeção mais fiel.`,
    });
  }

  // 7. Dependência de uma receita.
  const totalIncome = p.incomeList.reduce((s, t) => s + t.amount, 0);
  const biggest = p.incomeList[0];
  if (biggest && totalIncome > 0 && biggest.amount / totalIncome >= 0.5 && p.incomeList.length > 1) {
    out.push({
      id: "income-dep",
      level: "info",
      title: `${Math.round((biggest.amount / totalIncome) * 100)}% das entradas dependem de ${biggest.description}`,
      detail: `Previsto para ${br(biggest.date)} (${brl(biggest.amount)}). Marque "E se atrasar?" no simulador para ver o impacto.`,
    });
  }

  // 8. Sobra.
  if (worst.balance >= 0 && p.endWithEstimate > 0.5 && negatives.length === 0) {
    out.push({
      id: "surplus",
      level: "positive",
      title: `Sobra prevista de ${brl(p.endWithEstimate)} no fim do mês`,
      detail: `O caixa não fica negativo em nenhum dia (menor saldo ${brl(worst.balance)} em ${br(worst.date)}). Antes de gastar, defina o destino: reserva para o mês seguinte e, havendo folga, amortização das dívidas mais caras.`,
    });
  }

  const order: Record<SuggestionLevel, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

function entityLabel(t: string | null) {
  return t === "business" ? "a empresa (PJ)" : t === "personal" ? "a pessoa física (PF)" : "entidades diferentes";
}
