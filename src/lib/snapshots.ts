// Regras comuns de Investimentos e Patrimônio (snapshots mensais com abertura e fechamento).

/** Primeiro dia do mês anterior (yyyy-MM-dd), sem conversão de fuso. Aceita yyyy-MM ou yyyy-MM-dd. */
export function prevMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}-01`;
}

/** Primeiro dia do mês seguinte (yyyy-MM-dd). */
export function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/** Fechamento lançado conta, inclusive zero. Só null/undefined é "em aberto". */
export function isClosed(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && !Number.isNaN(Number(v));
}

/** Valor do item no mês: fechamento se houver; senão a abertura (estimativa de mês em andamento). */
export function currentValue(s: { opening_value: number | null; closing_value: number | null }): number {
  return isClosed(s.closing_value) ? Number(s.closing_value) : Number(s.opening_value) || 0;
}

export interface MonthPoint {
  month: string;       // yyyy-MM-dd (como gravado)
  total: number | null; // null = mês com item sem fechamento (fica fora do gráfico)
  open: number;        // itens sem fechamento
  items: number;
}

/** Série mensal só com meses totalmente fechados; meses com pendência ficam como lacuna (null). */
export function monthlySeries<T extends { reference_month: string; closing_value: number | null }>(
  rows: T[],
  value: (r: T) => number = (r) => Number(r.closing_value) || 0,
): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  rows.forEach((r) => {
    const p = map.get(r.reference_month) || { month: r.reference_month, total: 0, open: 0, items: 0 };
    p.items += 1;
    if (isClosed(r.closing_value)) p.total = (p.total ?? 0) + value(r);
    else p.open += 1;
    map.set(r.reference_month, p);
  });
  return Array.from(map.values())
    .map((p) => ({ ...p, total: p.open > 0 ? null : Math.round((p.total ?? 0) * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Converte texto digitado (pt-BR ou ponto) em número; vazio = null. Retorna undefined se inválido. */
export function parseMoneyInput(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  let s = t.replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}
