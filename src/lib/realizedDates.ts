// LAN-01: lançamento "Realizado" tem data de pagamento (realização) igual ao vencimento.
// Preenche os dois campos a partir do que existir: vencimento > pagamento > hoje.

export function realizedDates(due: Date | null | undefined, payment: Date | null | undefined, today: Date): { due: Date; payment: Date } {
  if (due) return { due, payment: due };
  if (payment) return { due: payment, payment };
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { due: d, payment: d };
}
