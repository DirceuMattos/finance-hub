import { describe, expect, it } from "vitest";
import { byCategory, matchesSearch, monthWindow, summarize, totalsByMonth, trendOf, type AnalysisRow } from "./spendAnalysis";

let n = 0;
const row = (p: Partial<AnalysisRow>): AnalysisRow => ({
  id: `r${++n}`, description: "x", amount: 100, date: "2026-10-10", status: "paid", categoryId: "sup", categoryName: "Supermercados",
  accountId: "a", accountName: "Itaú - PF", payee: null, notes: null, cardName: null, forecast: false, ...p,
});

describe("monthWindow", () => {
  it("meses terminando no selecionado, atravessando o ano", () => {
    expect(monthWindow("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(monthWindow("2026-10", 1)).toEqual(["2026-10"]);
  });
});

describe("matchesSearch", () => {
  const r = row({ description: "Supermercado Pão de Açúcar", payee: "GPA", cardName: "Itaú 2223 - Pessoal", amount: 550 });
  it("todas as palavras, sem acento, em qualquer campo", () => {
    expect(matchesSearch(r, "pao acucar")).toBe(true);
    expect(matchesSearch(r, "gpa 2223")).toBe(true);
    expect(matchesSearch(r, "550,00")).toBe(true);
    expect(matchesSearch(r, "supermercados")).toBe(true); // categoria
    expect(matchesSearch(r, "pao carrefour")).toBe(false);
    expect(matchesSearch(r, "  ")).toBe(true);
  });
});

describe("totais, resumo e tendência", () => {
  const months = ["2026-08", "2026-09", "2026-10"];
  const rows = [
    row({ amount: 800, date: "2026-08-05" }), row({ amount: 900, date: "2026-09-05" }),
    row({ amount: 1000, date: "2026-10-05" }), row({ amount: 100, date: "2026-10-20" }),
    row({ amount: 999, date: "2026-07-05" }),
  ];
  it("soma por mês só dentro da janela", () => {
    expect(totalsByMonth(rows, months)).toEqual([
      { month: "2026-08", total: 800, count: 1, forecast: 0, forecastCount: 0 }, { month: "2026-09", total: 900, count: 1, forecast: 0, forecastCount: 0 },
      { month: "2026-10", total: 1100, count: 2, forecast: 0, forecastCount: 0 },
    ]);
  });
  it("compara com o mês anterior e com a média dos anteriores", () => {
    expect(summarize(totalsByMonth(rows, months))).toEqual({ current: 1100, previous: 900, deltaPrev: 22.2, average: 850, deltaAvg: 29.4 });
  });
  it("tendência de alta, queda e estável", () => {
    expect(trendOf([800, 900, 1100])).toMatchObject({ slope: 150, direction: "up" });
    expect(trendOf([1000, 800, 600]).direction).toBe("down");
    expect(trendOf([1000, 1010, 995]).direction).toBe("flat");
    expect(trendOf([500]).direction).toBe("flat");
  });
});

describe("fato x previsão", () => {
  it("previsão fica fora do total, da média e da tendência, e aparece à parte", () => {
    const months = ["2026-09", "2026-10", "2026-11"];
    const rows = [
      row({ amount: 2500, date: "2026-09-10" }), row({ amount: 2600, date: "2026-10-10" }),
      row({ amount: 444, date: "2026-11-05" }), row({ amount: 3219, date: "2026-11-25", forecast: true }),
    ];
    const pts = totalsByMonth(rows, months);
    expect(pts[2]).toEqual({ month: "2026-11", total: 444, count: 1, forecast: 3219, forecastCount: 1 });
    expect(summarize(pts).current).toBe(444);
    const c = byCategory(rows, months)[0];
    expect([c.current, c.forecast, c.average]).toEqual([444, 3219, 2550]);
  });
});

describe("byCategory", () => {
  it("mês selecionado contra a média dos anteriores, maior variação primeiro", () => {
    const months = ["2026-09", "2026-10"];
    const rows = [
      row({ amount: 1000, date: "2026-09-01" }), row({ amount: 1300, date: "2026-10-01" }),
      row({ categoryId: "lz", categoryName: "Lazer", amount: 400, date: "2026-09-01" }),
      row({ categoryId: null, categoryName: null, amount: 50, date: "2026-10-01" }),
    ];
    const c = byCategory(rows, months);
    expect(c.map((x) => [x.name, x.current, x.average, x.delta])).toEqual([
      ["Lazer", 0, 400, -400], ["Supermercados", 1300, 1000, 300], ["Sem categoria", 50, 0, 50],
    ]);
  });
});
