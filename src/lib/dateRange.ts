// LAN-02: filtro por período (datas) dentro do mês escolhido na tela de Lançamentos.
// A data usada é a mesma do filtro de mês: vencimento; sem vencimento, a competência.

export interface RangeCheck {
  ok: boolean;
  error: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(v: string): boolean {
  if (!ISO.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function br(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Valida "de/até" contra o mês (yyyy-MM). Datas vazias são permitidas (sem limite). */
export function validateRange(month: string, from: string, to: string): RangeCheck {
  if (!from && !to) return { ok: true, error: null };
  if (!month || month === "all") return { ok: false, error: "Escolha um mês antes de informar as datas." };
  for (const [label, v] of [["inicial", from], ["final", to]] as const) {
    if (!v) continue;
    if (!isRealDate(v)) return { ok: false, error: `Data ${label} inválida.` };
    if (monthOf(v) !== month) {
      const [y, m] = month.split("-");
      return { ok: false, error: `A data ${label} (${br(v)}) não pertence a ${m}/${y}. Use uma data desse mês.` };
    }
  }
  if (from && to && from > to) return { ok: false, error: `A data inicial (${br(from)}) é posterior à final (${br(to)}).` };
  return { ok: true, error: null };
}

/** Data de referência do lançamento para o filtro: vencimento, senão competência. */
export function referenceDate(row: { due_date: string | null; competence_date: string | null }): string {
  return (row.due_date || row.competence_date || "").slice(0, 10);
}

export function inRange(row: { due_date: string | null; competence_date: string | null }, from: string, to: string): boolean {
  const d = referenceDate(row);
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
