// Análises por Despesas ou Receitas: funções puras (consultas em hooks/useSpendAnalysis.ts).
// Mês de cada lançamento = mês do vencimento (ou da competência), o mesmo critério de Movimentações.

export interface AnalysisRow {
  id: string;
  description: string;
  amount: number;          // positivo
  date: string;            // vencimento (ou competência), yyyy-MM-dd
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  accountName: string | null;
  payee: string | null;
  notes: string | null;
  cardName: string | null;
  forecast: boolean;       // previsão (recorrência ou marcada): estimativa, não fato
}

const pad = (n: number) => String(n).padStart(2, "0");
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Os `count` meses terminando em `month` (inclusive), do mais antigo ao mais recente. */
export function monthWindow(month: string, count: number): string[] {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca sensível a qualquer palavra: todas as palavras digitadas precisam aparecer em algum campo
 * (descrição, favorecido, observações, categoria, conta, cartão ou valor). Ignora acentos e maiúsculas.
 */
export function matchesSearch(row: AnalysisRow, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const value = row.amount.toFixed(2);
  const hay = norm([
    row.description, row.payee, row.notes, row.categoryName, row.accountName, row.cardName,
    value, value.replace(".", ","),
  ].filter(Boolean).join(" | "));
  return words.every((w) => hay.includes(w));
}

/** total = fato (o que de fato aconteceu ou foi comprado); forecast = previsões, mostradas à parte. */
export interface MonthPoint { month: string; total: number; count: number; forecast: number; forecastCount: number }

export function totalsByMonth(rows: AnalysisRow[], months: string[]): MonthPoint[] {
  const map = new Map(months.map((m) => [m, { total: 0, count: 0, forecast: 0, forecastCount: 0 }]));
  for (const r of rows) {
    const g = map.get(r.date.slice(0, 7));
    if (!g) continue;
    if (r.forecast) { g.forecast += r.amount; g.forecastCount++; }
    else { g.total += r.amount; g.count++; }
  }
  return months.map((m) => {
    const g = map.get(m)!;
    return { month: m, total: r2(g.total), count: g.count, forecast: r2(g.forecast), forecastCount: g.forecastCount };
  });
}

export interface Trend {
  slope: number;          // variação média por mês (R$), regressão linear
  slopePct: number | null; // slope sobre a média do período
  direction: "up" | "down" | "flat";
  fitted: number[];       // linha de tendência para o gráfico
}

/** Tendência por mínimos quadrados. "Estável" quando a variação mensal é menor que 3% da média. */
export function trendOf(values: number[]): Trend {
  const n = values.length;
  if (n < 2) return { slope: 0, slopePct: null, direction: "flat", fitted: values.slice() };
  const xm = (n - 1) / 2;
  const ym = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
  const slope = den ? num / den : 0;
  const slopePct = ym ? (slope / ym) * 100 : null;
  const direction = slopePct === null || Math.abs(slopePct) < 3 ? "flat" : slope > 0 ? "up" : "down";
  return { slope: r2(slope), slopePct: slopePct === null ? null : Math.round(slopePct * 10) / 10, direction,
    fitted: values.map((_, i) => r2(ym + slope * (i - xm))) };
}

export interface MonthSummary {
  current: number;
  previous: number | null;     // mês anterior
  deltaPrev: number | null;    // % vs mês anterior
  average: number;             // média dos meses anteriores ao selecionado
  deltaAvg: number | null;     // % vs média
}

export function summarize(points: MonthPoint[]): MonthSummary {
  const current = points[points.length - 1]?.total ?? 0;
  const before = points.slice(0, -1);
  const previous = before.length ? before[before.length - 1].total : null;
  const average = before.length ? r2(before.reduce((s, p) => s + p.total, 0) / before.length) : 0;
  const pct = (a: number, b: number | null) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
  return { current, previous, deltaPrev: pct(current, previous), average, deltaAvg: before.length ? pct(current, average) : null };
}

export interface CategoryRow {
  categoryId: string | null;
  name: string;
  current: number;   // fato no mês selecionado
  forecast: number;  // previsões no mês selecionado (à parte)
  average: number;   // média do fato nos meses anteriores do período
  delta: number;     // current − average
  months: number[];  // série do período (para minigráfico)
}

/** Por categoria: mês selecionado contra a média dos meses anteriores, maiores variações primeiro. */
export function byCategory(rows: AnalysisRow[], months: string[]): CategoryRow[] {
  const idx = new Map(months.map((m, i) => [m, i]));
  const map = new Map<string, CategoryRow>();
  for (const r of rows) {
    const i = idx.get(r.date.slice(0, 7));
    if (i === undefined) continue;
    const key = r.categoryId ?? "__sem";
    const g = map.get(key) ?? { categoryId: r.categoryId, name: r.categoryName ?? "Sem categoria", current: 0, forecast: 0, average: 0, delta: 0, months: months.map(() => 0) };
    if (r.forecast) { if (i === months.length - 1) g.forecast += r.amount; }
    else g.months[i] += r.amount;
    map.set(key, g);
  }
  const prevCount = months.length - 1;
  return Array.from(map.values()).map((g) => {
    const current = r2(g.months[g.months.length - 1]);
    const average = prevCount ? r2(g.months.slice(0, -1).reduce((s, v) => s + v, 0) / prevCount) : 0;
    return { ...g, months: g.months.map(r2), current, forecast: r2(g.forecast), average, delta: r2(current - average) };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current)
    .filter((g) => g.current > 0 || g.average > 0 || g.forecast > 0);
}
