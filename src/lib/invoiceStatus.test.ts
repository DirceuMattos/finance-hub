import { describe, expect, it } from "vitest";
import { invoiceStatus } from "./invoiceStatus";

const base = { paid: 0, planned: 0, dueDate: "2026-10-25", today: "2026-09-28", closed: false, closable: true };

describe("invoiceStatus", () => {
  it("fechada prevalece", () => expect(invoiceStatus({ ...base, paid: 10, planned: 5, closed: true })).toBe("closed"));
  it("tudo pago sem fechamento", () => expect(invoiceStatus({ ...base, paid: 10 })).toBe("paid_not_closed"));
  it("histórico pago (parcelas antigas)", () => expect(invoiceStatus({ ...base, paid: 10, closable: false })).toBe("paid"));
  it("vencida com pendência", () => expect(invoiceStatus({ ...base, planned: 5, dueDate: "2026-09-25" })).toBe("overdue"));
  it("parcial no prazo", () => expect(invoiceStatus({ ...base, paid: 10, planned: 5 })).toBe("partial"));
  it("prevista", () => expect(invoiceStatus({ ...base, planned: 5 })).toBe("planned"));
  it("vence hoje não é vencida", () => expect(invoiceStatus({ ...base, planned: 5, dueDate: "2026-09-28" })).toBe("planned"));
  it("vazia", () => expect(invoiceStatus(base)).toBe("empty"));
});
