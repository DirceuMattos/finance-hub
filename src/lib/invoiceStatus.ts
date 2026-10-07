// Situação de uma fatura de cartão, com a mesma leitura da tela Cartões.

export type InvoiceStatus = "closed" | "paid_not_closed" | "paid" | "overdue" | "partial" | "planned" | "empty";

export interface InvoiceStatusInput {
  paid: number;
  planned: number;
  dueDate: string | null;   // vencimento da fatura (yyyy-MM-dd)
  today: string;            // yyyy-MM-dd
  closed: boolean;          // existe registro de fechamento (card_invoice_payments)
  closable: boolean;        // fatura de lançamentos atuais (pode ser fechada no módulo Cartões)
}

export function invoiceStatus(i: InvoiceStatusInput): InvoiceStatus {
  if (i.closed) return "closed";
  if (i.planned <= 0 && i.paid <= 0) return "empty";
  if (i.planned <= 0) return i.closable ? "paid_not_closed" : "paid";
  if (i.dueDate && i.dueDate < i.today) return "overdue";
  if (i.paid > 0) return "partial";
  return "planned";
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  closed: "Fechada",
  paid_not_closed: "Paga · falta fechar",
  paid: "Paga",
  overdue: "Vencida em aberto",
  partial: "Parcial",
  planned: "Prevista",
  empty: "Sem lançamentos",
};
