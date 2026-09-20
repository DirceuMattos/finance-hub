import { describe, expect, it } from "vitest";
import { normalizeOptionalRelationId, parseRecurrenceAmount } from "./recurrenceRules";

describe("normalizeOptionalRelationId", () => {
  it.each([undefined, null, "", "none"])("normaliza %s como nulo", (value) => {
    expect(normalizeOptionalRelationId(value)).toBeNull();
  });

  it("preserva um identificador selecionado", () => {
    expect(normalizeOptionalRelationId("8a174c8a-2972-40f2-b2cd-e18ca684830f"))
      .toBe("8a174c8a-2972-40f2-b2cd-e18ca684830f");
  });
});

describe("parseRecurrenceAmount", () => {
  it("interpreta valor brasileiro com separador de milhar", () => {
    expect(parseRecurrenceAmount("1.234,56")).toBe(1234.56);
  });

  it("preserva valores numéricos", () => {
    expect(parseRecurrenceAmount(125.5)).toBe(125.5);
  });
});
