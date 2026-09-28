import { describe, expect, it } from "vitest";
import { cardCycleMonthOf, cardCycleWindow, formatIsoDateBR, normalizeDueDay } from "./cardCycle";

describe("cardCycleWindow", () => {
  it("vencimento 25: 26 do mês anterior a 25 do mês", () => {
    expect(cardCycleWindow("2026-09-01", 25)).toEqual({ start: "2026-08-26", end: "2026-09-25" });
  });
  it("aceita yyyy-MM", () => {
    expect(cardCycleWindow("2026-09", 25)).toEqual({ start: "2026-08-26", end: "2026-09-25" });
  });
  it("virada de ano", () => {
    expect(cardCycleWindow("2027-01", 25)).toEqual({ start: "2026-12-26", end: "2027-01-25" });
  });
  it("vencimento 10 não deixa buracos", () => {
    expect(cardCycleWindow("2026-09", 10)).toEqual({ start: "2026-08-11", end: "2026-09-10" });
  });
  it("vencimento 31 em mês curto", () => {
    expect(cardCycleWindow("2026-02", 31)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(cardCycleWindow("2026-03", 31)).toEqual({ start: "2026-03-01", end: "2026-03-31" });
  });
  it("ciclos consecutivos são contíguos", () => {
    for (const due of [1, 5, 10, 25, 28, 30, 31]) {
      for (let m = 1; m <= 12; m++) {
        const a = cardCycleWindow(`2026-${String(m).padStart(2, "0")}`, due);
        const nm = m === 12 ? "2027-01" : `2026-${String(m + 1).padStart(2, "0")}`;
        const b = cardCycleWindow(nm, due);
        const next = new Date(a.end + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
        expect(b.start).toBe(next.toISOString().slice(0, 10));
      }
    }
  });
});

describe("cardCycleMonthOf", () => {
  it("vencimento no dia 25 fica no mês", () => expect(cardCycleMonthOf("2026-09-25", 25)).toBe("2026-09"));
  it("dia 26 vai para o mês seguinte", () => expect(cardCycleMonthOf("2026-09-26", 25)).toBe("2026-10"));
  it("dezembro vira janeiro", () => expect(cardCycleMonthOf("2026-12-28", 25)).toBe("2027-01"));
  it("coerente com a janela", () => {
    const w = cardCycleWindow("2026-10", 25);
    expect(cardCycleMonthOf(w.start, 25)).toBe("2026-10");
    expect(cardCycleMonthOf(w.end, 25)).toBe("2026-10");
  });
});

describe("utilitários", () => {
  it("dia inválido usa 25", () => {
    expect(normalizeDueDay(null)).toBe(25);
    expect(normalizeDueDay(0)).toBe(25);
    expect(normalizeDueDay(40)).toBe(25);
  });
  it("formata sem fuso", () => {
    expect(formatIsoDateBR("2026-09-25")).toBe("25/09/2026");
    expect(formatIsoDateBR(null)).toBe("—");
  });
});
