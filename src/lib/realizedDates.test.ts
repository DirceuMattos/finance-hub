import { describe, expect, it } from "vitest";
import { realizedDates } from "./realizedDates";

const today = new Date(2026, 9, 6, 15, 30);

describe("realizedDates (LAN-01)", () => {
  it("com vencimento: pagamento = vencimento", () => {
    const due = new Date(2026, 9, 5);
    expect(realizedDates(due, new Date(2026, 9, 1), today)).toEqual({ due, payment: due });
  });
  it("só pagamento: vencimento = pagamento", () => {
    const p = new Date(2026, 9, 3);
    expect(realizedDates(null, p, today)).toEqual({ due: p, payment: p });
  });
  it("nenhum: os dois = hoje (sem hora)", () => {
    const r = realizedDates(null, null, today);
    expect(r.due).toEqual(new Date(2026, 9, 6));
    expect(r.payment).toEqual(new Date(2026, 9, 6));
  });
});
