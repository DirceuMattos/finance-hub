// Regra única de fatura de cartão (decisão 27/09/2026, opção A):
// a fatura do mês M reúne os lançamentos com vencimento entre o dia seguinte ao
// vencimento de M-1 e o dia de vencimento de M. Com vencimento dia 25: 26/(M-1) a 25/M.
// Meses curtos limitam o dia ao último dia do mês. Espelha public.card_cycle_bounds.

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month 1-12
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(day, 1), daysInMonth(year, month));
}

function parseYearMonth(ref: string): [number, number] {
  const [y, m] = ref.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Mês de referência inválido: ${ref}`);
  return [y, m];
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function normalizeDueDay(dueDay: number | null | undefined): number {
  const n = Number(dueDay);
  return Number.isFinite(n) && n >= 1 && n <= 31 ? Math.trunc(n) : 25;
}

/** Janela [start, end] (inclusiva, yyyy-MM-dd) da fatura do mês de referência. */
export function cardCycleWindow(referenceMonth: string, dueDay?: number | null): { start: string; end: string } {
  const due = normalizeDueDay(dueDay);
  const [y, m] = parseYearMonth(referenceMonth);
  const end = `${y}-${pad(m)}-${pad(clampDay(y, m, due))}`;
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const prevDue = `${py}-${pad(pm)}-${pad(clampDay(py, pm, due))}`;
  return { start: addDays(prevDue, 1), end };
}

/** Mês (yyyy-MM) da fatura a que pertence um vencimento. */
export function cardCycleMonthOf(dueDate: string, dueDay?: number | null): string {
  const due = normalizeDueDay(dueDay);
  const [y, m, d] = dueDate.split("-").map(Number);
  if (d <= clampDay(y, m, due)) return `${y}-${pad(m)}`;
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

/** Formata yyyy-MM-dd como dd/MM/yyyy sem conversão de fuso. */
export function formatIsoDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}
