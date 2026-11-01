import { describe, expect, it } from "vitest";
import { linesFromTextItems, parsePdfStatementLines } from "./pdfStatement";

describe("linesFromTextItems", () => {
  it("agrupa por altura, ordena da esquerda para a direita e de cima para baixo", () => {
    const lines = linesFromTextItems([
      { str: "-2,84", x: 400, y: 700, page: 1, width: 20 },
      { str: "06/10/2026", x: 40, y: 700.8, page: 1, width: 40 },
      { str: "SEGURO", x: 100, y: 700, page: 1, width: 30 },
      { str: "cabeçalho", x: 40, y: 760, page: 1, width: 40 },
      { str: "02/10/2026 IOF", x: 40, y: 680, page: 1, width: 60 },
      { str: "-3,78", x: 400, y: 680, page: 1, width: 20 },
    ]);
    expect(lines).toEqual(["cabeçalho", "06/10/2026   SEGURO   -2,84", "02/10/2026 IOF   -3,78"]);
  });
});

describe("parsePdfStatementLines", () => {
  it("modelo Itaú: valor com sinal e linhas de SALDO DO DIA", () => {
    const p = parsePdfStatementLines([
      "período de visualização: 13/08/2026 até 12/10/2026   emitido em: 12/10/2026",
      "data   lançamentos   valor (R$)   saldo (R$)",
      "07/10/2026 SALDO DO DIA   -1.060,41",
      "06/10/2026 SEGURO LIS ITAU 0000   -2,84",
      "15/09/2026 PIX RECEBIDO FULANO   1.500,00",
      "15/09/2026 SALDO DO DIA   -1.053,79",
    ]);
    expect(p.source).toBe("pdf");
    expect([p.periodStart, p.periodEnd]).toEqual(["2026-08-13", "2026-10-12"]);
    expect([p.ledgerBalance, p.ledgerDate]).toEqual([-1060.41, "2026-10-07"]);
    expect(p.lines).toEqual([
      { date: "2026-09-15", amount: 1500, memo: "PIX RECEBIDO FULANO", fitid: null },
      { date: "2026-10-06", amount: -2.84, memo: "SEGURO LIS ITAU 0000", fitid: null },
    ]);
  });

  it("modelo com D/C, colunas valor e saldo, data só na primeira linha do dia e descrição em 2 linhas", () => {
    const p = parsePdfStatementLines([
      "Extrato de 01/10/2026 a 31/10/2026",
      "01/10/26 SALDO ANTERIOR   1.000,00 C",
      "03/10/26 TARIFA PACOTE   25,90 D   974,10 C",
      "PIX ENVIADO   100,00 D   874,10 C",
      "MERCADO BOM PRECO",
      "10/10/26 TED RECEBIDA   2.000,00 C   2.874,10 C",
      "Total de créditos   2.000,00",
    ]);
    expect(p.lines.map((l) => [l.date, l.amount, l.memo])).toEqual([
      ["2026-10-03", -25.9, "TARIFA PACOTE"],
      ["2026-10-03", -100, "PIX ENVIADO MERCADO BOM PRECO"],
      ["2026-10-10", 2000, "TED RECEBIDA"],
    ]);
    expect([p.ledgerBalance, p.ledgerDate]).toEqual([2874.1, "2026-10-10"]);
  });

  it("avisa quando não encontra lançamentos (PDF escaneado ou outro documento)", () => {
    const p = parsePdfStatementLines(["Relatório sem lançamentos"]);
    expect(p.lines).toEqual([]);
    expect(p.warnings[0]).toContain("PDF escaneado");
  });
});
