import { describe, expect, it } from "vitest";
import {
  monthBounds, projectMonth, referenceMonths, suggestActions, variableEstimates,
  type ProjAccount, type ProjCategory, type ProjTx,
} from "./monthProjection";

const accounts: ProjAccount[] = [
  { id: "pj", name: "Nu-Bank PJ", entityId: "E_PJ", balance: 5000 },
  { id: "pf", name: "BRA-PF", entityId: "E_PF", balance: 300 },
];
const categories: ProjCategory[] = [
  { id: "food", name: "Alimentação", group: "variable", nature: "expense" },
  { id: "rent", name: "Aluguel", group: "fixed", nature: "expense" },
  { id: "fuel", name: "Combustível", group: "variable", nature: "expense" },
];
let n = 0;
const tx = (p: Partial<ProjTx>): ProjTx => ({
  id: `t${++n}`, description: "x", amount: 100, type: "expense", entityId: "E_PF", accountId: "pf",
  categoryId: null, cardName: null, date: "2026-11-10", ...p,
});

describe("auxiliares de data", () => {
  it("limites do mês e meses de referência", () => {
    expect(monthBounds("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28", days: 28 });
    expect(referenceMonths("2026-10-15")).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(referenceMonths("2026-01-05")).toEqual(["2025-10", "2025-11", "2025-12"]);
  });
});

describe("variableEstimates", () => {
  const ref = ["2026-07", "2026-08", "2026-09"];
  it("média só de categorias variáveis recorrentes, menos o já lançado", () => {
    const paid = [
      { categoryId: "food", entityId: "E_PF", amount: 900, date: "2026-07-05" },
      { categoryId: "food", entityId: "E_PF", amount: 1200, date: "2026-08-05" },
      { categoryId: "food", entityId: "E_PF", amount: 900, date: "2026-09-05" },
      { categoryId: "fuel", entityId: "E_PF", amount: 600, date: "2026-09-05" }, // só 1 mês: fora
      { categoryId: "rent", entityId: "E_PF", amount: 2000, date: "2026-09-05" }, // fixa: fora
      { categoryId: "food", entityId: "E_PF", amount: 5000, date: "2026-06-05" }, // fora da janela
    ];
    const e = variableEstimates(paid, { food: 400 }, categories, ref);
    expect(e).toEqual([{ categoryId: "food", name: "Alimentação", average: 1000, inMonth: 400, gap: 600, months: 3 }]);
  });
});

describe("projectMonth", () => {
  const base = {
    accounts, categories, cards: [{ name: "Nu PJ", entityId: "E_PJ", managerialLimit: 1000 }],
    month: "2026-11", today: "2026-10-30",
  };

  it("saldo inicial na véspera, totais do mês, pior dia e conta negativa", () => {
    const planned = [
      tx({ amount: 200, date: "2026-10-31" }),                                  // ainda em outubro
      tx({ amount: 900, date: "2026-11-05" }),                                  // PF fica negativa
      tx({ type: "income", amount: 2000, date: "2026-11-20", accountId: "pj", entityId: "E_PJ" }),
      tx({ amount: 1500, date: "2026-11-25", accountId: "pj", entityId: "E_PJ", cardName: "Nu PJ", categoryId: "food" }),
      tx({ amount: 50, date: "2026-12-02" }),                                   // depois do mês: fora
    ];
    const p = projectMonth({ ...base, planned, estimates: [] });
    expect(p.startBalance).toBe(5100);
    expect(p.income).toBe(2000);
    expect(p.expense).toBe(2400);
    expect(p.invoices).toBe(1500);
    expect(p.endLaunched).toBe(4700);
    expect(p.worstLaunched).toEqual({ date: "2026-11-05", balance: 4200 });
    const pf = p.accounts.find((a) => a.id === "pf")!;
    expect(pf).toMatchObject({ start: 100, end: -800, min: -800, minDate: "2026-11-05", firstNegative: "2026-11-05" });
    expect(p.invoiceList).toEqual([{ cardName: "Nu PJ", dueDate: "2026-11-25", total: 1500, count: 1, managerialLimit: 1000, accounts: ["Nu-Bank PJ"], topCategories: [{ name: "Alimentação", total: 1500 }] }]);
  });

  it("previsto atrasado entra hoje e é contado", () => {
    const p = projectMonth({ ...base, month: "2026-10", today: "2026-10-30", planned: [tx({ amount: 100, date: "2026-10-01" })], estimates: [] });
    expect(p.overdue).toEqual({ count: 1, net: -100 });
    expect(p.days[0]).toMatchObject({ date: "2026-10-30", launched: 5200 });
    expect(p.startBalance).toBe(5300);
  });

  it("estimativa distribuída no mês e simulador (adiar, atrasar receita, cortar estimativa)", () => {
    const exp = tx({ amount: 1000, date: "2026-11-03" });
    const inc = tx({ type: "income", amount: 3000, date: "2026-11-15", accountId: "pj", entityId: "E_PJ" });
    const est = [{ categoryId: "food", name: "Alimentação", average: 3000, inMonth: 0, gap: 3000, months: 3 }];
    const p = projectMonth({ ...base, planned: [exp, inc], estimates: est });
    expect(p.estimate).toBe(3000);
    expect(p.endLaunched).toBe(7300);
    expect(p.endWithEstimate).toBe(4300);
    const s = projectMonth({ ...base, planned: [exp, inc], estimates: est, sim: { postponedTxIds: [exp.id], delayedIncomeIds: [inc.id], estimateCuts: { food: 0.5 } } });
    expect(s.endLaunched).toBe(5300);
    expect(s.estimate).toBe(1500);
    expect(s.endWithEstimate).toBe(3800);
  });
});

describe("suggestActions", () => {
  const entityType = (id: string) => (id === "E_PJ" ? "business" : "personal");
  it("sugere transferência quando outra conta cobre, com alerta PF/PJ, e aponta teto", () => {
    const planned = [
      tx({ amount: 900, date: "2026-11-05" }),
      tx({ amount: 1500, date: "2026-11-25", accountId: "pj", entityId: "E_PJ", cardName: "Nu PJ", categoryId: "food" }),
    ];
    const p = projectMonth({ accounts, categories, cards: [{ name: "Nu PJ", entityId: "E_PJ", managerialLimit: 1000 }], planned, estimates: [], month: "2026-11", today: "2026-10-30" });
    const s = suggestActions({ projection: p, planned, estimates: [], entityType, today: "2026-10-30" });
    const neg = s.find((x) => x.id === "neg-pf")!;
    expect(neg.level).toBe("critical");
    expect(neg.detail).toContain("Transferir R$");
    expect(neg.detail).toContain("Nu-Bank PJ");
    expect(neg.detail).toContain("contador");
    expect(s.some((x) => x.id.startsWith("teto-Nu PJ"))).toBe(true);
    expect(s.some((x) => x.level === "positive")).toBe(false);
  });

  it("aponta falta de caixa consolidada e sobra quando tudo fica positivo", () => {
    const small: ProjAccount[] = [{ id: "pf", name: "BRA-PF", entityId: "E_PF", balance: 100 }];
    const planned = [tx({ amount: 600, date: "2026-11-05", description: "Aluguel" }), tx({ type: "income", amount: 2000, date: "2026-11-20", description: "Cliente A" })];
    const p = projectMonth({ accounts: small, categories, cards: [], planned, estimates: [], month: "2026-11", today: "2026-10-30" });
    const s = suggestActions({ projection: p, planned, estimates: [], entityType, today: "2026-10-30" });
    const w = s.find((x) => x.id === "worst")!;
    expect(w.title).toContain("05/11");
    expect(w.detail).toContain("Cliente A");

    const ok = projectMonth({ accounts, categories, cards: [], planned: [tx({ amount: 100 })], estimates: [], month: "2026-11", today: "2026-10-30" });
    expect(suggestActions({ projection: ok, planned: [], estimates: [], entityType, today: "2026-10-30" }).map((x) => x.level)).toEqual(["positive"]);
  });

  it("categoria lançada muito acima da média", () => {
    const p = projectMonth({ accounts, categories, cards: [], planned: [], estimates: [], month: "2026-11", today: "2026-10-30" });
    const est = [{ categoryId: "food", name: "Alimentação", average: 1000, inMonth: 1600, gap: 0, months: 3 }];
    const s = suggestActions({ projection: p, planned: [], estimates: est, entityType, today: "2026-10-30" });
    expect(s.find((x) => x.id === "cat-food")?.detail).toContain("600,00");
  });
});
