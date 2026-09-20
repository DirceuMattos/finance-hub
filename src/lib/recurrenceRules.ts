export function normalizeOptionalRelationId(value?: string | null): string | null {
  if (!value || value === "none") return null;
  return value;
}

export function parseRecurrenceAmount(value: string | number): number {
  if (typeof value === "number") return value;

  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(normalized);
}
