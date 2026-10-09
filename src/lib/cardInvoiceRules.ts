// Cutoff date for temporal UX rule
export const CUTOFF_DATE = "2026-02-25";

// Legacy category-based constants (kept for backward compat)
export const CARD_INVOICE_CATEGORIES = [
  "Cartões de Crédito - Pessoal",
  "Cartões de Crédito - Prof.",
];

export const CARD_MAP: Record<string, string> = {};
export const REVERSE_CARD_MAP: Record<string, string> = {};
export const REVERSE_CENTER_COST_MAP: Record<string, string> = {};

export function isCardInvoice(categoryName?: string | null): boolean {
  if (!categoryName) return false;
  return CARD_INVOICE_CATEGORIES.includes(categoryName);
}

export function getCardInvoiceStatus(categoryName: string, competenceDate: string): "paid" | "pending" {
  if (!isCardInvoice(categoryName)) return "pending";
  return competenceDate <= CUTOFF_DATE ? "paid" : "pending";
}

export function getCardInvoiceLabel(categoryName: string): string {
  return CARD_MAP[categoryName] ?? "";
}

export function getTemporalDisplayStatus(competenceDate: string): "historical" | "projected" {
  return competenceDate <= CUTOFF_DATE ? "historical" : "projected";
}
