// Ajuste do valor de um item da fatura (ex.: IOF/impostos calculados só na fatura).
// Guarda o valor anterior nas observações para manter o histórico.
import { evaluateExpression } from "@/lib/calc";

export interface AmountChange {
  ok: boolean;
  error: string;
  amount: number;
  notes: string;
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function buildAmountChange(
  current: { amount: number; notes: string | null },
  text: string,
  today: string, // yyyy-MM-dd
): AmountChange {
  const amount = evaluateExpression(text);
  const fail = (error: string): AmountChange => ({ ok: false, error, amount: 0, notes: current.notes || "" });
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return fail("Informe um valor maior que zero.");
  const value = Math.round(amount * 100) / 100;
  const before = Math.abs(Number(current.amount) || 0);
  if (Math.abs(value - before) < 0.005) return fail("O valor é igual ao atual.");
  const mark = `[ajuste na fatura em ${br(today)}: de ${brl(before)} para ${brl(value)}]`;
  const notes = current.notes ? `${current.notes.trim()} ${mark}` : mark;
  return { ok: true, error: "", amount: value, notes };
}
