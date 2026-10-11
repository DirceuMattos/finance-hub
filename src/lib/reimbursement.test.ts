import { describe, expect, it } from "vitest";
import { buildReimbursement } from "./reimbursement";

const base = {
  amountText: "1.234,56",
  accountId: "acc-1",
  accountEntityId: "ent-1",
  categoryId: "cat-1",
  cardName: "Nu Bank 4747 - Empresarial",
  dueDate: "2026-10-25",
  referenceLabel: "10/2026",
};

describe("buildReimbursement", () => {
  it("gera receita prevista na conta, com vencimento da fatura e fora da fatura", () => {
    const r = buildReimbursement(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.amount).toBe(1234.56);
    expect(r.payload!).toMatchObject({
      transaction_type: "income",
      status: "planned",
      account_id: "acc-1",
      financial_entity_id: "ent-1",
      category_id: "cat-1",
      due_date: "2026-10-25",
      competence_date: "2026-10-25",
      center_cost: null,
      payment_date: null,
    });
    expect(r.payload!.description).toBe("Reembolso — Nu Bank 4747 - Empresarial (fatura 10/2026)");
  });

  it("aceita expressão", () => {
    const r = buildReimbursement({ ...base, amountText: "100 + 50,5" });
    expect(r.ok && r.amount).toBe(150.5);
  });

  it.each([
    [{ amountText: "" }, "valor"],
    [{ amountText: "0" }, "valor"],
    [{ amountText: "-10" }, "valor"],
    [{ amountText: "abc" }, "valor"],
    [{ accountId: "" }, "conta"],
    [{ accountEntityId: null }, "entidade"],
    [{ categoryId: undefined }, "Reembolsos"],
    [{ dueDate: "25/10/2026" }, "Vencimento"],
  ])("bloqueia entrada inválida %o", (patch, msg) => {
    const r = buildReimbursement({ ...base, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });
});
