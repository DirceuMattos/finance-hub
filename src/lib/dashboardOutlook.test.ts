import { describe, expect, it } from "vitest";
import { cardLimits, monthOutlook } from "./dashboardOutlook";

const accounts = [
  { name: "BRA - PF", current_balance: -10113.23, financial_entity_id: "pf" },
  { name: "Aposenta - PF", current_balance: 5157.69, financial_entity_id: "pf" },
  { name: "Nu-Bank - PJ", current_balance: 14549.36, financial_entity_id: "pj" },
];
const pending = [
  { amount: 4000, transaction_type: "income", financial_entity_id: "pf", due_date: "2026-10-20", competence_date: "2026-10-01" },
  { amount: 1000, transaction_type: "expense", financial_entity_id: "pf", due_date: "2026-10-25", competence_date: "2026-10-01" },
  { amount: 300, transaction_type: "expense", financial_entity_id: "pf", due_date: "2026-09-10", competence_date: "2026-09-01" }, // atrasado
  { amount: 999, transaction_type: "expense", financial_entity_id: "pf", due_date: "2026-11-05", competence_date: "2026-11-01" }, // mês seguinte
  { amount: 200, transaction_type: "expense", financial_entity_id: "pf", due_date: null, competence_date: "2026-10-15" },
  { amount: 26600, transaction_type: "income", financial_entity_id: "pj", due_date: "2026-10-30", competence_date: "2026-10-01" },
];

describe("monthOutlook", () => {
  it("soma saldo atual + previstos até o fim do mês, por visão, e lista contas negativas", () => {
    const r = monthOutlook(accounts, pending, ["pf"], "2026-11-01", "2026-10-11")!;
    expect(r.current).toBe(-4955.54);
    expect(r.incomePlanned).toBe(4000);
    expect(r.expensePlanned).toBe(1500);
    expect(r.projected).toBe(-2455.54);
    expect(r.overdueCount).toBe(1);
    expect(r.overdueNet).toBe(-300);
    expect(r.negatives).toEqual([{ name: "BRA - PF", balance: -10113.23 }]);
  });

  it("consolidado inclui todas as entidades", () => {
    const r = monthOutlook(accounts, pending, null, "2026-11-01", "2026-10-11")!;
    expect(r.current).toBe(9593.82);
    expect(r.projected).toBeCloseTo(38693.82, 2);
  });

  it("mês futuro acumula previstos até o fim dele", () => {
    const r = monthOutlook(accounts, pending, ["pf"], "2026-12-01", "2026-10-11")!;
    expect(r.expensePlanned).toBe(2499);
  });

  it("mês encerrado não tem previsão", () => {
    expect(monthOutlook(accounts, pending, null, "2026-10-01", "2026-10-11")).toBeNull();
  });
});

describe("cardLimits", () => {
  const cards = [
    { name: "Nu PJ", entity_type: "business", due_day: 25, credit_limit: 20000, managerial_limit: 4000 },
    { name: "Itaú", entity_type: "personal", due_day: 25, credit_limit: 0, managerial_limit: 3500 },
    { name: "Sem uso", entity_type: "personal", due_day: 25, credit_limit: 0, managerial_limit: 0 },
  ];
  const txs = [
    { center_cost: "Nu PJ", amount: 3000, status: "paid", due_date: "2026-09-26" },
    { center_cost: "Nu PJ", amount: 500, status: "planned", due_date: "2026-10-25" },
    { center_cost: "Nu PJ", amount: 700, status: "planned", due_date: "2026-11-25" }, // parcela futura
    { center_cost: "Nu PJ", amount: 9999, status: "cancelled", due_date: "2026-10-10" },
    { center_cost: "Nu PJ", amount: 100, status: "paid", due_date: "2026-09-25" }, // fatura anterior
    { center_cost: "Itaú", amount: 6868.22, status: "planned", due_date: "2026-10-25" },
  ];

  it("calcula margem do mês, nível e limite disponível", () => {
    const [nu, itau] = cardLimits(cards, txs, "2026-10");
    expect(nu).toMatchObject({ invoice: 3500, ceiling: 4000, margin: 500, level: "attention", openTotal: 1200, available: 18800 });
    expect(nu.cycleStart).toBe("2026-09-26");
    expect(itau).toMatchObject({ invoice: 6868.22, margin: -3368.22, level: "over", available: null });
  });

  it("esconde cartão sem teto, sem limite e sem uso", () => {
    expect(cardLimits(cards, txs, "2026-10").map((r) => r.name)).toEqual(["Nu PJ", "Itaú"]);
  });

  it("nível ok abaixo de 80% e none sem teto", () => {
    const r = cardLimits([{ ...cards[0], managerial_limit: 10000 }, { ...cards[1], managerial_limit: 0 }], txs, "2026-10");
    expect(r[0].level).toBe("ok");
    expect(r[1].level).toBe("none");
  });
});
