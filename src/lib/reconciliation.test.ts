import { describe, expect, it } from "vitest";
import { effectiveDate, monthBounds, officialBalance, reconcileMonth, reconciliationCsv, ReconTransaction } from "./reconciliation";

const acc = { id: "a", name: "BRA", opening_balance: -1000, opening_balance_date: "2026-03-31", current_balance: 0 };
const tx = (p: Partial<ReconTransaction>): ReconTransaction => ({
  id: Math.random().toString(), description: "x", amount: 100, transaction_type: "expense", status: "paid",
  payment_date: null, competence_date: null, due_date: null, ...p,
});

describe("reconciliation", () => {
  it("data efetiva: pagamento > competência > vencimento", () => {
    expect(effectiveDate({ payment_date: "2026-04-02", competence_date: "2026-05-01", due_date: "2026-05-10" })).toBe("2026-04-02");
    expect(effectiveDate({ payment_date: null, competence_date: "2026-05-01", due_date: "2026-05-10" })).toBe("2026-05-01");
    expect(effectiveDate({ payment_date: null, competence_date: null, due_date: "2026-05-10" })).toBe("2026-05-10");
  });

  it("limites do mês", () => {
    expect(monthBounds("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  const txs = [
    tx({ description: "antes da data-base", payment_date: "2026-03-31", amount: 999 }),
    tx({ description: "abril salário", transaction_type: "income", payment_date: "2026-04-05", amount: 5000 }),
    tx({ description: "abril conta", payment_date: "2026-04-10", amount: 300 }),
    tx({ description: "pago em abril, competência maio", payment_date: "2026-04-28", competence_date: "2026-05-01", amount: 200 }),
    tx({ description: "maio", payment_date: "2026-05-03", amount: 50 }),
    tx({ description: "previsto maio", status: "planned", due_date: "2026-05-20", amount: 80 }),
    tx({ description: "cancelado", status: "cancelled", payment_date: "2026-05-04", amount: 70 }),
  ];

  it("abril: abertura + movimentos do mês, ignora data-base e outros meses", () => {
    const r = reconcileMonth(acc, txs, "2026-04");
    expect(r.startBalance).toBe(-1000);
    expect(r.inflow).toBe(5000);
    expect(r.outflow).toBe(500);
    expect(r.endBalance).toBe(3500);
    expect(r.lines.map((l) => l.running_balance)).toEqual([4000, 3700, 3500]);
  });

  it("maio começa onde abril termina; previstos e cancelados não contam", () => {
    const r = reconcileMonth(acc, txs, "2026-05");
    expect(r.startBalance).toBe(3500);
    expect(r.endBalance).toBe(3450);
    expect(r.planned).toHaveLength(1);
    expect(r.plannedTotal).toBe(-80);
  });

  it("mês anterior à data-base sinalizado", () => {
    expect(reconcileMonth(acc, txs, "2026-03").beforeOpening).toBe(true);
  });

  it("saldo oficial total", () => {
    expect(officialBalance(acc, txs)).toBe(3450);
  });

  it("CSV com ; e vírgula decimal", () => {
    const csv = reconciliationCsv("BRA", reconcileMonth(acc, txs, "2026-04"));
    expect(csv).toContain('"Saldo final";"3500,00"');
    expect(csv.split("\r\n").length).toBeGreaterThan(8);
  });
});
