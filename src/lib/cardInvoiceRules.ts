export const CARD_INVOICE_CATEGORIES = [
  "Cartões de Crédito - Pessoal",
  "Cartões de Crédito - Prof.",
];

export const CUTOFF_DATE = "2026-02-25";

export const CARD_MAP: Record<string, string> = {
  "Cartões de Crédito - Pessoal": "BRA Pessoal",
  "Cartões de Crédito - Prof.": "Nu Infotkt",
};

export function isCardInvoice(categoryName?: string | null): boolean {
  if (!categoryName) return false;
  return CARD_INVOICE_CATEGORIES.includes(categoryName);
}

export function getCardInvoiceStatus(
  categoryName: string,
  competenceDate: string
): "paid" | "pending" {
  if (!isCardInvoice(categoryName)) return "pending";
  return competenceDate <= CUTOFF_DATE ? "paid" : "pending";
}

export function getCardInvoiceLabel(categoryName: string): string {
  return CARD_MAP[categoryName] ?? "";
}
