import { describe, expect, it } from "vitest";
import {
  dropInternalTransfers, monthBounds, projectHorizon, projectMonth, recurrenceOccurrences, referenceMonths, suggestActions, variableEstimates,
  type ProjAccount, type ProjCategory, type ProjRecurrence, type ProjTx,
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
    expect(e).toEqual([{ categoryId: "food", name: "Alimentação", average: 900, inMonth: 400, gap: 500, months: 3, largest: 0 }]);
  });

  it("mediana ignora um mês fora da curva", () => {
    const paid = [
      { categoryId: "food", entityId: "E_PF", amount: 500, date: "2026-07-05" },
      { categoryId: "food", entityId: "E_PF", amount: 24000, date: "2026-08-05" },
      { categoryId: "food", entityId: "E_PF", amount: 700, date: "2026-09-05" },
    ];
    expect(variableEstimates(paid, {}, categories, ref)[0].average).toBe(700);
  });

  it("transferência entre contas próprias sai da base", () => {
    const exp = [{ amount: 23866.97, date: "2026-08-10", id: 1 }, { amount: 100, date: "2026-08-10", id: 2 }, { amount: 50, date: "2026-08-01", id: 3 }];
    const inc = [{ amount: 23866.97, date: "2026-08-11" }, { amount: 50, date: "2026-08-20" }];
    expect(dropInternalTransfers(exp, inc).map((e) => e.id)).toEqual([2, 3]);
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
  const cards = [{ name: "Nu PJ", entityId: "E_PJ", managerialLimit: 1000, dueDay: 25 }];

  it("agrupa contas negativas no mês com transferência possível e alerta PF/PJ; faturas acima do teto", () => {
    const planned = [
      tx({ amount: 900, date: "2026-11-05" }),
      tx({ amount: 700, date: "2026-11-02", accountId: "pj", entityId: "E_PJ", cardName: "Nu PJ", categoryId: "food" }),
      tx({ amount: 800, date: "2026-11-20", accountId: "pj", entityId: "E_PJ", cardName: "Nu PJ", categoryId: "food" }),
    ];
    const p = projectMonth({ accounts, categories, cards, planned, estimates: [], month: "2026-11", today: "2026-10-30" });
    expect(p.invoiceList).toHaveLength(1);
    expect(p.invoiceList[0]).toMatchObject({ dueDate: "2026-11-25", total: 1500, count: 2 });
    const s = suggestActions({ projection: p, planned, estimates: [], entityType, today: "2026-10-30" });
    expect(s.map((x) => x.id)).toEqual(["accounts", "cards"]);
    expect(s[0].title).toBe("1 conta(s) ficam negativas no mês");
    expect(s[0].detail).toContain("Nu-Bank PJ → BRA-PF R$");
    expect(s[0].detail).toContain("contador");
  });

  it("caixa total: falta no pior dia com a maior saída antes e entrada depois; sobra quando positivo", () => {
    const small: ProjAccount[] = [{ id: "pf", name: "BRA-PF", entityId: "E_PF", balance: 100 }];
    const planned = [tx({ amount: 600, date: "2026-11-05", description: "Aluguel" }), tx({ type: "income", amount: 2000, date: "2026-11-20", description: "Cliente A" })];
    const p = projectMonth({ accounts: small, categories, cards: [], planned, estimates: [], month: "2026-11", today: "2026-10-30" });
    const s = suggestActions({ projection: p, planned, estimates: [], entityType, today: "2026-10-30" });
    expect(s[0].id).toBe("cash");
    expect(s[0].title).toContain("05/11");
    expect(s[0].detail).toContain("Aluguel");
    expect(s[0].detail).toContain("Cliente A");

    const ok = projectMonth({ accounts, categories, cards: [], planned: [tx({ amount: 100 })], estimates: [], month: "2026-11", today: "2026-10-30" });
    expect(suggestActions({ projection: ok, planned: [], estimates: [], entityType, today: "2026-10-30" }).map((x) => x.level)).toEqual(["positive"]);
  });

  it("estimativa só pesa nas decisões quando pedida", () => {
    const est = [{ categoryId: "food", name: "Alimentação", average: 9000, inMonth: 0, gap: 9000, months: 3 }];
    const p = projectMonth({ accounts, categories, cards: [], planned: [], estimates: est, month: "2026-11", today: "2026-10-30" });
    expect(suggestActions({ projection: p, planned: [], estimates: est, entityType, today: "2026-10-30" })[0].id).toBe("surplus");
    expect(suggestActions({ projection: p, planned: [], estimates: est, entityType, today: "2026-10-30", useEstimate: true })[0].id).toBe("cash");
  });

  it("categorias acima do típico agregadas, ignorando lançamento único grande", () => {
    const p = projectMonth({ accounts, categories, cards: [], planned: [], estimates: [], month: "2026-11", today: "2026-10-30" });
    const est = [
      { categoryId: "food", name: "Alimentação", average: 1000, inMonth: 1600, gap: 0, months: 3, largest: 300 },
      { categoryId: "loan", name: "Empréstimos", average: 2300, inMonth: 29200, gap: 0, months: 3, largest: 28000 },
    ];
    const s = suggestActions({ projection: p, planned: [], estimates: est, entityType, today: "2026-10-30" });
    const c = s.find((x) => x.id === "categories")!;
    expect(c.title).toContain("600,00");
    expect(c.detail).not.toContain("Empréstimos");
  });
});

describe("meses à frente", () => {
  const rec = (p: Partial<ProjRecurrence>): ProjRecurrence => ({
    id: "r1", description: "Aluguel", amount: 1000, type: "expense", entityId: "E_PF", accountId: "pf", categoryId: null,
    cardName: null, frequency: "monthly", dueDay: 31, dayOfWeek: null, startsOn: "2026-01-10", endsOn: null, ...p,
  });

  it("gera ocorrências mensais que faltam, respeitando fim e dia curto", () => {
    const occ = recurrenceOccurrences([rec({ endsOn: "2027-03-15" })], new Set(["r1|2026-11-30"]), "2026-10-30", "2027-06-30");
    expect(occ.map((o) => o.date)).toEqual(["2026-10-31", "2026-12-31", "2027-01-31", "2027-02-28"]);
    expect(occ[0]).toMatchObject({ id: "rec:r1:2026-10-31", description: "Aluguel (recorrência)", type: "expense" });
  });

  it("gera ocorrências semanais no dia da semana", () => {
    const occ = recurrenceOccurrences([rec({ frequency: "weekly", dayOfWeek: 1 })], new Set(), "2026-11-01", "2026-11-20");
    expect(occ.map((o) => o.date)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("estimativa dos meses anteriores pesa no saldo inicial e a visão de meses marca receita baixa", () => {
    const est = (gap: number) => [{ categoryId: "food", name: "Alimentação", average: gap, inMonth: 0, gap, months: 3 }];
    const args = {
      accounts, categories, cards: [], today: "2026-10-31",
      planned: [tx({ type: "income", amount: 4000, date: "2026-11-05", accountId: "pj", entityId: "E_PJ" })],
      estimatesByMonth: { "2026-10": est(310), "2026-11": est(300), "2026-12": est(310) },
    };
    const dez = projectMonth({ ...args, month: "2026-12" });
    expect(dez.startBalance).toBe(9300);
    expect(dez.startWithEstimate).toBe(8690);  // −10 (1 dia de outubro) −300 (novembro)
    expect(dez.endWithEstimate).toBe(8380);
    const h = projectHorizon(args, ["2026-11", "2026-12"], 3000);
    expect(h.map((r) => [r.month, r.income, r.estimate, r.endWithEstimate, r.lowIncome])).toEqual([
      ["2026-11", 4000, 300, 8690, false],
      ["2026-12", 0, 310, 8380, true],
    ]);
  });

  it("avisa quando as receitas do mês estão muito abaixo da média", () => {
    const p = projectMonth({ accounts, categories, cards: [], planned: [], estimates: [], month: "2026-12", today: "2026-10-30" });
    const s = suggestActions({ projection: p, planned: [], estimates: [], entityType: () => "personal", today: "2026-10-30", avgIncome: 5000 });
    expect(s[0].id).toBe("low-income");
  });
});
