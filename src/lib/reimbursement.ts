// Reembolso de despesas do cartão: vira uma receita PREVISTA na conta escolhida,
// com vencimento igual ao da fatura. Não entra na fatura (center_cost vazio) e
// só afeta o saldo quando for marcada como paga, como qualquer receita.
import { evaluateExpression } from "@/lib/calc";

export interface ReimbursementInput {
  amountText: string;
  accountId: string;
  accountEntityId: string | null | undefined;
  categoryId: string | null | undefined;
  cardId?: string;
  cardName: string;
  dueDate: string; // vencimento da fatura, yyyy-MM-dd
  referenceLabel?: string;
}

export interface ReimbursementResult {
  ok: boolean;
  error: string;
  amount: number;
  payload: Record<string, unknown> | null;
}

const fail = (error: string): ReimbursementResult => ({ ok: false, error, amount: 0, payload: null });

/** Marcador gravado nas observações para ligar o reembolso ao cartão (sem coluna nova no banco). */
export const reimbursementMarker = (cardId: string) => `[reembolso-cartao:${cardId}]`;

export interface ReimbursementTx {
  id: string;
  description: string | null;
  notes: string | null;
  amount: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  account_id: string | null;
}

/**
 * O reembolso pertence à fatura quando vence no mesmo dia da fatura e
 * tem o marcador do cartão (novos) ou a descrição padrão do modal (lançados antes do marcador).
 */
export function isReimbursementOf(tx: ReimbursementTx, card: { id: string; name: string }, invoiceDueDate: string): boolean {
  if (tx.status === "cancelled" || tx.due_date !== invoiceDueDate) return false;
  if ((tx.notes || "").includes(reimbursementMarker(card.id))) return true;
  const prefix = `Reembolso — ${card.name}`;
  const desc = tx.description || "";
  return desc === prefix || desc.startsWith(`${prefix} (`);
}

export interface ReimbursementSummary {
  planned: number;  // previsto (a receber)
  received: number; // já recebido (pago)
  total: number;
  count: number;
}

export function summarizeReimbursements(txs: ReimbursementTx[]): ReimbursementSummary {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let planned = 0, received = 0, count = 0;
  for (const t of txs) {
    if (t.status === "cancelled") continue;
    const v = Math.abs(Number(t.amount) || 0);
    if (t.status === "paid") received += v; else planned += v;
    count++;
  }
  return { planned: r2(planned), received: r2(received), total: r2(planned + received), count };
}

export function buildReimbursement(input: ReimbursementInput): ReimbursementResult {
  const amount = evaluateExpression(input.amountText);
  if (amount === null || amount <= 0) return fail("Informe um valor de reembolso maior que zero.");
  if (!input.accountId) return fail("Escolha a conta que vai receber o reembolso.");
  if (!input.accountEntityId) return fail("A conta escolhida não tem entidade definida.");
  if (!input.categoryId) return fail("Categoria \"Reembolsos\" não encontrada. Cadastre-a em Categorias.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return fail("Vencimento da fatura inválido.");

  const ref = input.referenceLabel ? ` (fatura ${input.referenceLabel})` : "";
  return {
    ok: true,
    error: "",
    amount,
    payload: {
      description: `Reembolso — ${input.cardName}${ref}`,
      transaction_type: "income",
      category_id: input.categoryId,
      financial_entity_id: input.accountEntityId,
      account_id: input.accountId,
      amount,
      competence_date: input.dueDate,
      due_date: input.dueDate,
      payment_date: null,
      status: "planned",
      source_type: "manual",
      center_cost: null,
      notes: `Lançado pelo modal da fatura do cartão ${input.cardName}.${input.cardId ? ` ${reimbursementMarker(input.cardId)}` : ""}`,
    },
  };
}
