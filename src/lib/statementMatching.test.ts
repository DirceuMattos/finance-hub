import { describe, expect, it } from "vitest";
import { approvedEffect, matchStatement, suggestDescription, suggestPattern, type AppTx } from "./statementMatching";

const tx = (id: string, date: string, amount: number, type = "expense", status = "paid", extra: Partial<AppTx> = {}): AppTx => ({
  id, description: id, amount, transaction_type: type, status, payment_date: status === "paid" ? date : null,
  competence_date: date, due_date: date, ...extra,
});
const L = (date: string, amount: number, memo = "x") => ({ date, amount, memo, fitid: null });

describe("matchStatement", () => {
  it("concilia 1:1 pela data mais próxima e marca o que falta dos dois lados", () => {
    const r = matchStatement(
      [L("2026-09-10", -100), L("2026-09-12", -100), L("2026-09-15", -40, "Pix LITOPARK")],
      [tx("a", "2026-09-11", 100), tx("b", "2026-09-13", 100), tx("c", "2026-09-14", 77)],
      [],
    );
    expect(r.bank.map((b) => [b.status, b.appIds])).toEqual([["matched", ["a"]], ["matched", ["b"]], ["missing", []]]);
    expect(r.bank[2].suggestion).toBe("create");
    expect(r.appOnly.map((a) => a.tx.id)).toEqual(["c"]);
    expect(r.matchedCount).toBe(2);
  });

  it("agrupa vários lançamentos do app em um Pix", () => {
    const r = matchStatement(
      [L("2026-09-26", -660, "Pix Rosineide")],
      [tx("l1", "2026-09-26", 110), tx("l2", "2026-09-26", 110), tx("l3", "2026-09-26", 220), tx("l4", "2026-09-26", 220)],
      [],
    );
    expect(r.bank[0].status).toBe("group");
    expect(r.bank[0].appIds.sort()).toEqual(["l1", "l2", "l3", "l4"]);
    expect(r.appOnly).toEqual([]);
  });

  it("agrupa várias linhas do extrato em um lançamento do app", () => {
    const r = matchStatement([L("2026-09-14", -1750), L("2026-09-14", -50)], [tx("emp", "2026-09-14", 1800)], []);
    expect(r.bank.every((b) => b.status === "group" && b.appIds[0] === "emp")).toBe(true);
  });

  it("valor diferente pequeno vira sugestão de ajuste de valor", () => {
    const r = matchStatement([L("2026-09-10", -1040.85, "SEFAZ")], [tx("ipva", "2026-09-10", 1041)], []);
    expect(r.bank[0]).toMatchObject({ status: "near", appIds: ["ipva"], appAmount: -1041, suggestion: "update_amount" });
  });

  it("previsto de mesmo valor perto da data vira sugestão de baixa", () => {
    const r = matchStatement([L("2026-10-06", -64.51, "PAGTO COBRANCA")], [], [tx("seg", "2026-10-05", 64.51, "expense", "planned")]);
    expect(r.bank[0]).toMatchObject({ status: "planned", plannedId: "seg", suggestion: "settle" });
  });

  it("aplicação e resgate de caixinha são internos", () => {
    const r = matchStatement([L("2026-09-10", 2600, "Resgate RDB"), L("2026-09-25", -5000, "Aplicação RDB")], [], []);
    expect(r.bank.map((b) => b.status)).toEqual(["internal", "internal"]);
    expect(r.bankTotal).toBe(0);
  });

  it("usa a regra aprendida mais específica", () => {
    const r = matchStatement([L("2026-09-28", -69.61, "Pix - COMPANHIA AGUAS DE JOINVILLE")], [], [], [
      { pattern: "aguas", description: "Água", category_id: "c1", transaction_type: "expense" },
      { pattern: "aguas de joinville", description: "ÁGUA", category_id: "c2", transaction_type: "expense" },
    ]);
    expect(r.bank[0].rule?.category_id).toBe("c2");
  });

  it("ignora lançamentos fora do período do extrato", () => {
    const r = matchStatement([L("2026-09-10", -10)], [tx("old", "2026-08-01", 10), tx("new", "2026-11-01", 10)], []);
    expect(r.appOnly).toEqual([]);
    expect(r.bank[0].status).toBe("missing");
  });
});

describe("textos sugeridos", () => {
  it("limpa CPF/CNPJ, banco e agência do histórico", () => {
    const m = "Transferência enviada pelo Pix - CELESC DISTRIBUICAO S.A - 08.336.783/0001-90 - BCO BRADESCO S.A. (0237) Agência: 3178 Conta: 724-2";
    expect(suggestDescription(m)).toBe("CELESC DISTRIBUICAO S.A");
    expect(suggestPattern(m)).toBe("celesc distribuicao s.a");
    expect(suggestDescription("Pix - Fulano - •••.835.339-•• - COOP SICREDI")).toBe("Pix - Fulano");
  });
});

describe("approvedEffect", () => {
  it("soma o efeito das sugestões aprovadas no saldo", () => {
    expect(approvedEffect([
      { kind: "create", bankAmount: -40 },
      { kind: "settle", bankAmount: -64.51 },
      { kind: "update_amount", bankAmount: -1040.85, appAmount: -1041 },
      { kind: "cancel", bankAmount: 0, appSigned: -170 },
      { kind: "ignore", bankAmount: 999 },
    ])).toBe(-40 - 64.51 + 0.15 + 170);
  });
});

describe("pagamento de fatura", () => {
  it("junta os itens do cartão ao pagamento da fatura e não sugere lançar o pagamento", () => {
    const card = { center_cost: "Nu Bank 4747" };
    const r = matchStatement(
      [L("2026-09-25", -8630.39, "Pagamento de fatura"), L("2026-09-25", -214.76, "Pix outro")],
      [tx("c1", "2026-09-25", 8000, "expense", "paid", card), tx("c2", "2026-09-24", 214.76, "expense", "paid", card)],
      [],
    );
    expect(r.bank[0]).toMatchObject({ status: "invoice", suggestion: "ignore", appAmount: -8214.76 });
    expect(r.bank[0].appIds.sort()).toEqual(["c1", "c2"]);
    // item de cartão não casa com linha avulsa do extrato
    expect(r.bank[1].status).toBe("missing");
  });
  it("reconhece pagamento de fatura pelo total mesmo sem a palavra fatura", () => {
    const card = { center_cost: "Itaú 2223" };
    const r = matchStatement([L("2026-08-26", -2921.2, "Pagamento de boleto - ITAU")], [tx("i1", "2026-08-25", 2900, "expense", "paid", card)], []);
    expect(r.bank[0].status).toBe("invoice");
  });
});
