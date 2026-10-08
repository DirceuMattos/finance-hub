import { describe, expect, it } from "vitest";
import { currentValue, isClosed, monthlySeries, nextMonthStart, parseMoneyInput, prevMonthStart } from "./snapshots";

describe("snapshots", () => {
  it("mês anterior/seguinte sem fuso", () => {
    expect(prevMonthStart("2026-08")).toBe("2026-07-01");
    expect(prevMonthStart("2026-08-01")).toBe("2026-07-01");
    expect(prevMonthStart("2026-01-01")).toBe("2025-12-01");
    expect(nextMonthStart("2026-12-01")).toBe("2027-01-01");
  });
  it("zero é fechamento válido; null é em aberto", () => {
    expect(isClosed(0)).toBe(true);
    expect(isClosed(null)).toBe(false);
    expect(currentValue({ opening_value: 100, closing_value: 0 })).toBe(0);
    expect(currentValue({ opening_value: 100, closing_value: null })).toBe(100);
  });
  it("série com lacuna em mês aberto", () => {
    const s = monthlySeries([
      { reference_month: "2026-03-01", closing_value: 10 },
      { reference_month: "2026-03-01", closing_value: 0 },
      { reference_month: "2026-04-01", closing_value: null },
      { reference_month: "2026-04-01", closing_value: 5 },
      { reference_month: "2026-07-01", closing_value: 20 },
    ]);
    expect(s.map((p) => p.total)).toEqual([10, null, 20]);
    expect(s[1].open).toBe(1);
  });
  it("valor digitado", () => {
    expect(parseMoneyInput("1.234,56")).toBe(1234.56);
    expect(parseMoneyInput("R$ 10,5")).toBe(10.5);
    expect(parseMoneyInput("0")).toBe(0);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeUndefined();
  });
});
