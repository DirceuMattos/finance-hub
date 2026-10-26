import { describe, expect, it } from "vitest";
import { buildAmountChange } from "./invoiceAmountEdit";

describe("buildAmountChange", () => {
  it("aceita expressão e registra o valor anterior nas observações", () => {
    const r = buildAmountChange({ amount: 214.76, notes: null }, "214,76 + 7,52", "2026-10-26");
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(222.28);
    expect(r.notes.replace(/\u00a0/g, " ")).toBe("[ajuste na fatura em 26/10/2026: de R$ 214,76 para R$ 222,28]");
  });

  it("mantém observações existentes", () => {
    const r = buildAmountChange({ amount: 100, notes: "Latam 4/4" }, "103,80", "2026-10-26");
    expect(r.notes.replace(/\u00a0/g, " ")).toBe("Latam 4/4 [ajuste na fatura em 26/10/2026: de R$ 100,00 para R$ 103,80]");
  });

  it.each([["", "maior que zero"], ["0", "maior que zero"], ["-5", "maior que zero"], ["abc", "maior que zero"], ["100,00", "igual ao atual"]])(
    "recusa %s", (text, msg) => {
      const r = buildAmountChange({ amount: 100, notes: null }, text, "2026-10-26");
      expect(r.ok).toBe(false);
      expect(r.error).toContain(msg);
    },
  );
});
