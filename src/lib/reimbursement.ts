// Reembolso de despesas do cartão: vira uma receita PREVISTA na conta escolhida,
// com vencimento igual ao da fatura. Não entra na fatura (center_cost vazio) e
// só afeta o saldo quando for marcada como paga, como qualquer receita.
import { evaluateExpression } from "@/lib/calc";

export interface ReimbursementInput {
  amountText: string;
  accountId: string;
  accountEntityId: string | null | undefined;
  categoryId: string | null | undefined;
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
      notes: `Lançado pelo modal da fatura do cartão ${input.cardName}.`,
    },
  };
}
