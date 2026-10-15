import { describe, expect, it } from "vitest";
import { buildReimbursement, isReimbursementOf, reimbursementMarker, summarizeReimbursements, type ReimbursementTx } from "./reimbursement";

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

describe("vínculo do reembolso com a fatura", () => {
  const card = { id: "card-1", name: "Nu Bank 4747 - Empresarial" };
  const tx = (p: Partial<ReimbursementTx>): ReimbursementTx => ({
    id: "t", description: "", notes: null, amount: 100, due_date: "2026-10-25", status: "planned", payment_date: null, account_id: "a", ...p,
  });

  it("grava o marcador do cartão nas observações", () => {
    const r = buildReimbursement({ ...base, cardId: "card-1" });
    expect(String(r.payload!.notes)).toContain(reimbursementMarker("card-1"));
  });

  it("reconhece pelo marcador, mesmo com descrição alterada", () => {
    expect(isReimbursementOf(tx({ description: "Outro texto", notes: "x [reembolso-cartao:card-1]" }), card, "2026-10-25")).toBe(true);
  });

  it("reconhece reembolsos antigos pela descrição padrão", () => {
    expect(isReimbursementOf(tx({ description: "Reembolso — Nu Bank 4747 - Empresarial (fatura Outubro 2026)" }), card, "2026-10-25")).toBe(true);
    expect(isReimbursementOf(tx({ description: "Reembolso — Nu Bank 4747 - Empresarial" }), card, "2026-10-25")).toBe(true);
  });

  it("ignora outro cartão, outro vencimento e cancelados", () => {
    expect(isReimbursementOf(tx({ description: "Reembolso — Nu Bank 4747 - Empresarial 2 (fatura X)" }), card, "2026-10-25")).toBe(false);
    expect(isReimbursementOf(tx({ notes: "[reembolso-cartao:card-2]" }), card, "2026-10-25")).toBe(false);
    expect(isReimbursementOf(tx({ notes: "[reembolso-cartao:card-1]", due_date: "2026-11-25" }), card, "2026-10-25")).toBe(false);
    expect(isReimbursementOf(tx({ notes: "[reembolso-cartao:card-1]", status: "cancelled" }), card, "2026-10-25")).toBe(false);
  });

  it("soma previsto e recebido", () => {
    const s = summarizeReimbursements([tx({ amount: 100.1 }), tx({ amount: 50.2, status: "paid" }), tx({ amount: 9, status: "cancelled" })]);
    expect(s).toEqual({ planned: 100.1, received: 50.2, total: 150.3, count: 2 });
  });
});
