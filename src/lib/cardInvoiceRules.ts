// Center costs used to identify card invoice transactions
export const CARD_INVOICE_CENTER_COSTS = [
  "Cartão de Crédito - Pessoal",
  "Cartão de Crédito - Prof.",
  "Cartões de Crédito - Pessoal",
  "Cartões de Crédito - Prof.",
  "XP 7927 - Pessoal",
];

// Map center_cost → entity type
export const CENTER_COST_ENTITY_MAP: Record<string, "personal" | "business"> = {
  "Cartão de Crédito - Pessoal": "personal",
  "Cartão de Crédito - Prof.": "business",
  "Cartões de Crédito - Pessoal": "personal",
  "Cartões de Crédito - Prof.": "business",
  "XP 7927 - Pessoal": "personal",
};

// Cutoff date for temporal UX rule
export const CUTOFF_DATE = "2026-02-25";

// Legacy category-based constants (kept for backward compat)
export const CARD_INVOICE_CATEGORIES = [
  "Cartões de Crédito - Pessoal",
  "Cartões de Crédito - Prof.",
];

export const CARD_MAP: Record<string, string> = {};
export const REVERSE_CARD_MAP: Record<string, string> = {};
export const CENTER_COST_CARD_MAP: Record<string, string> = {};
export const REVERSE_CENTER_COST_MAP: Record<string, string> = {};

export function isCardInvoiceByCenterCost(centerCost?: string | null): boolean {
  if (!centerCost) return false;
  return CARD_INVOICE_CENTER_COSTS.includes(centerCost);
}

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

export function getCardNameFromCenterCost(centerCost: string): string {
  return CENTER_COST_CARD_MAP[centerCost] ?? "";
}

export function getEntityTypeFromCenterCost(centerCost: string): "personal" | "business" | null {
  return CENTER_COST_ENTITY_MAP[centerCost] ?? null;
}

export function getTemporalDisplayStatus(competenceDate: string): "historical" | "projected" {
  return competenceDate <= CUTOFF_DATE ? "historical" : "projected";
}
