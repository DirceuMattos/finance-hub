import { describe, expect, it } from "vitest";
import { parseBrNumber, parseCsv, parseOfx, parseStatement } from "./statementParsers";

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>0260<BRANCHID>1<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260814000000[-3:BRT]<DTEND>20261012000000[-3:BRT]
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260814000000[-3:BRT]<TRNAMT>-100.00<FITID>a1<MEMO>Compra no débito - POSTO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260825000000[-3:BRT]<TRNAMT>22202.87<FITID>a2<MEMO>Transferência recebida pelo Pix - CLIENTE</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>980.96<DTASOF>20261012000000[-3:BRT]</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_XML = `<?xml version="1.0"?><OFX><BANKACCTFROM><BANKID>348</BANKID><ACCTID>999</ACCTID></BANKACCTFROM>
<BANKTRANLIST><STMTTRN><DTPOSTED>20260911</DTPOSTED><TRNAMT>-81.00</TRNAMT><MEMO>Pix enviado</MEMO></STMTTRN>
<STMTTRN><DTPOSTED>20260908</DTPOSTED><TRNAMT>500.00</TRNAMT><MEMO>TED recebida</MEMO></STMTTRN></BANKTRANLIST>
<LEDGERBAL><BALAMT>35.23</BALAMT><DTASOF>20261012</DTASOF></LEDGERBAL></OFX>`;

const CSV = `﻿Extrato de: Ag: 1 | Conta: 2;;;;;
Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)
13/08/2026;COD. LANC. 0;0; ;0,00;9.515,61
17/08/2026;PIX RECEBIDO;852467;275,00; ;9.240,61
17/08/2026;COMPRA CARTAO VISA;102; ;128,98;9.369,59
;;;;;
Últimos Lancamentos;;;;;
Data;Histórico;Docto.;Crédito (R$);Débito (R$);
13/10/2026;COMPRA CARTAO VISA;89825; ;9,87;3.882,42
`;

describe("parseBrNumber", () => {
  it.each([["1.234,56", 1234.56], ["-100.00", -100], ["9,87", 9.87], ["(10,00)", -10], ["", null], ["abc", null]])("%s", (i, o) => {
    expect(parseBrNumber(i as string)).toBe(o);
  });
});

describe("parseOfx", () => {
  it("lê OFX SGML com conta, período, linhas e saldo", () => {
    const r = parseOfx(OFX);
    expect(r.bankRef).toBe("260:12345-6");
    expect(r.periodStart).toBe("2026-08-14");
    expect(r.periodEnd).toBe("2026-10-12");
    expect(r.ledgerBalance).toBe(980.96);
    expect(r.ledgerDate).toBe("2026-10-12");
    expect(r.lines).toEqual([
      { date: "2026-08-14", amount: -100, memo: "Compra no débito - POSTO", fitid: "a1" },
      { date: "2026-08-25", amount: 22202.87, memo: "Transferência recebida pelo Pix - CLIENTE", fitid: "a2" },
    ]);
  });
  it("lê OFX em XML e ordena por data", () => {
    const r = parseStatement("x.ofx", OFX_XML);
    expect(r.bankRef).toBe("348:999");
    expect(r.lines.map((l) => l.amount)).toEqual([500, -81]);
    expect(r.ledgerBalance).toBe(35.23);
  });
});

describe("parseCsv", () => {
  it("lê CSV com crédito/débito em mais de um bloco e ignora linha de saldo", () => {
    const r = parseStatement("extrato.csv", CSV);
    expect(r.source).toBe("csv");
    expect(r.lines).toEqual([
      { date: "2026-08-17", amount: 275, memo: "PIX RECEBIDO", fitid: null },
      { date: "2026-08-17", amount: -128.98, memo: "COMPRA CARTAO VISA", fitid: null },
      { date: "2026-10-13", amount: -9.87, memo: "COMPRA CARTAO VISA", fitid: null },
    ]);
    expect(r.periodStart).toBe("2026-08-17");
    expect(r.ledgerBalance).toBeNull();
  });
  it("lê CSV com coluna única de valor separado por vírgula", () => {
    const r = parseCsv(`data,descricao,valor\n2026-09-01,"Mercado, loja",-50.5\n2026-09-02,Salário,1000`);
    expect(r.lines.map((l) => [l.memo, l.amount])).toEqual([["Mercado, loja", -50.5], ["Salário", 1000]]);
  });
  it("avisa quando não acha cabeçalho", () => {
    expect(parseCsv("a;b\n1;2").warnings.length).toBe(1);
  });
});
