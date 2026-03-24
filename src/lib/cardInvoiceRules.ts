// --- Center cost based identification (primary method) ---

export const CARD_INVOICE_CENTER_COSTS = [
  "Cartão de Crédito - Pessoal",
  "Cartão de Crédito - Prof.",
];

export const CENTER_COST_CARD_MAP: Record<string, string> = {
  "Cartão de Crédito - Pessoal": "BRA Pessoal",
  "Cartão de Crédito - Prof.": "Nu Infotkt",
};

// Reverse: card name → center_cost
export const REVERSE_CENTER_COST_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CENTER_COST_CARD_MAP).map(([cc, card]) => [card, cc])
);

// --- Legacy category-based constants (kept for backward compat) ---

export const CARD_INVOICE_CATEGORIES = [
  "Cartões de Crédito - Pessoal",
  "Cartões de Crédito - Prof.",
];

export const CUTOFF_DATE = "2026-02-25";

export const CARD_MAP: Record<string, string> = {
  "Cartões de Crédito - Pessoal": "BRA Pessoal",
  "Cartões de Crédito - Prof.": "Nu Infotkt",
};

export const REVERSE_CARD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CARD_MAP).map(([cat, card]) => [card, cat])
);

// --- Identification helpers ---

/** Check if a transaction is a card invoice by center_cost */
export function isCardInvoiceByCenterCost(centerCost?: string | null): boolean {
  if (!centerCost) return false;
  return CARD_INVOICE_CENTER_COSTS.includes(centerCost);
}

/** Check if a transaction is a card invoice by category name (legacy) */
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

/** Get card name from center_cost */
export function getCardNameFromCenterCost(centerCost: string): string {
  return CENTER_COST_CARD_MAP[centerCost] ?? "";
}
