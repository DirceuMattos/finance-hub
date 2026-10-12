// Leitura de extratos bancários (OFX e CSV) no navegador. O arquivo não é enviado nem guardado:
// só as linhas extraídas seguem para a conciliação.

export interface StatementLine {
  date: string;   // yyyy-MM-dd
  amount: number; // positivo = entrada, negativo = saída
  memo: string;
  fitid: string | null;
}

export interface ParsedStatement {
  source: "ofx" | "csv";
  bankRef: string | null;      // banco:conta (OFX), para reconhecer a conta do app
  periodStart: string | null;
  periodEnd: string | null;
  ledgerBalance: number | null; // saldo informado pelo banco (OFX)
  ledgerDate: string | null;
  lines: StatementLine[];
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function ofxTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : null;
}

function ofxDate(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Converte "1.234,56", "-1234.56", "1234,56" em número. */
export function parseBrNumber(raw: string): number | null {
  let s = (raw || "").replace(/R\$\s?/i, "").replace(/\s/g, "").trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith("-")) { neg = true; s = s.slice(0, -1); }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return round2(neg ? -n : n);
}

export function parseOfx(text: string): ParsedStatement {
  const warnings: string[] = [];
  const bankId = ofxTag(text, "BANKID");
  const acctId = ofxTag(text, "ACCTID");
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) || [];
  const lines: StatementLine[] = [];
  for (const b of blocks) {
    const date = ofxDate(ofxTag(b, "DTPOSTED"));
    const amount = parseBrNumber(ofxTag(b, "TRNAMT") || "");
    if (!date || amount === null) { warnings.push("Linha do OFX ignorada (sem data ou valor)."); continue; }
    const memo = ofxTag(b, "MEMO") || ofxTag(b, "NAME") || "";
    lines.push({ date, amount, memo, fitid: ofxTag(b, "FITID") });
  }
  const ledger = text.match(/<LEDGERBAL>[\s\S]*?(?:<\/LEDGERBAL>|$)/i)?.[0] ?? "";
  const ledgerBalance = ledger ? parseBrNumber(ofxTag(ledger, "BALAMT") || "") : null;
  return {
    source: "ofx",
    bankRef: bankId || acctId ? `${(bankId || "").replace(/^0+/, "")}:${acctId || ""}` : null,
    periodStart: ofxDate(ofxTag(text, "DTSTART")),
    periodEnd: ofxDate(ofxTag(text, "DTEND")),
    ledgerBalance,
    ledgerDate: ledger ? ofxDate(ofxTag(ledger, "DTASOF")) : null,
    lines: lines.sort((a, b) => a.date.localeCompare(b.date)),
    warnings,
  };
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === sep && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * CSV de banco: procura linhas de cabeçalho com "data" e "valor" ou "crédito/débito".
 * Aceita mais de um bloco no arquivo (ex.: Bradesco "Últimos lançamentos").
 */
export function parseCsv(text: string): ParsedStatement {
  const warnings: string[] = [];
  const rawLines = text.replace(/^﻿/, "").split(/\r?\n/);
  const sep = (rawLines.slice(0, 10).join("\n").match(/;/g) || []).length >= (rawLines.slice(0, 10).join("\n").match(/,/g) || []).length ? ";" : ",";
  const lines: StatementLine[] = [];
  let cols: { date: number; memo: number; value: number; credit: number; debit: number } | null = null;
  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw, sep);
    const n = cells.map(norm);
    const di = n.findIndex((c) => c === "data" || c.startsWith("data "));
    if (di >= 0 && n.some((c) => c.includes("valor") || c.includes("credito") || c.includes("debito"))) {
      cols = {
        date: di,
        memo: n.findIndex((c) => c.includes("historico") || c.includes("descricao") || c.includes("lancamento")),
        value: n.findIndex((c) => c === "valor" || c.startsWith("valor")),
        credit: n.findIndex((c) => c.includes("credito")),
        debit: n.findIndex((c) => c.includes("debito")),
      };
      continue;
    }
    if (!cols) continue;
    const date = csvDate(cells[cols.date] || "");
    if (!date) continue;
    let amount: number | null = null;
    if (cols.value >= 0 && (cells[cols.value] || "").trim()) amount = parseBrNumber(cells[cols.value]);
    else {
      const c = cols.credit >= 0 ? parseBrNumber(cells[cols.credit] || "") : null;
      const d = cols.debit >= 0 ? parseBrNumber(cells[cols.debit] || "") : null;
      if (c) amount = Math.abs(c);
      else if (d) amount = -Math.abs(d);
    }
    if (amount === null || amount === 0) continue; // saldo anterior, linhas informativas
    lines.push({ date, amount: round2(amount), memo: cols.memo >= 0 ? cells[cols.memo] || "" : "", fitid: null });
  }
  if (!cols) warnings.push("Não encontrei o cabeçalho do CSV (precisa de colunas Data e Valor ou Crédito/Débito).");
  lines.sort((a, b) => a.date.localeCompare(b.date));
  return {
    source: "csv",
    bankRef: null,
    periodStart: lines[0]?.date ?? null,
    periodEnd: lines[lines.length - 1]?.date ?? null,
    ledgerBalance: null,
    ledgerDate: null,
    lines,
    warnings,
  };
}

export function parseStatement(fileName: string, text: string): ParsedStatement {
  const isOfx = /\.ofx$/i.test(fileName) || /<OFX>/i.test(text) || /OFXHEADER/i.test(text);
  return isOfx ? parseOfx(text) : parseCsv(text);
}

/** Lê o arquivo como texto; OFX de bancos brasileiros às vezes vem em latin-1. */
export async function readStatementFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("iso-8859-1").decode(buf);
}

/** Impressão digital do conteúdo (SHA-256) para recusar o mesmo arquivo duas vezes. */
export async function statementHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
