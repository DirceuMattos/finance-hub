// Leitura de extratos bancários em PDF, no navegador (pdf.js servido pelo próprio site em /vendor/pdfjs).
// O PDF não é enviado a nenhum servidor: só as linhas extraídas seguem para a conciliação.
// Funciona com PDFs de texto (gerados pelo banco). PDF escaneado (imagem) não tem texto para ler.
import { parseBrNumber, type ParsedStatement, type StatementLine } from "@/lib/statementParsers";

export interface TextItem { str: string; x: number; y: number; page: number; width?: number }

/** Junta os pedaços de texto do PDF em linhas (mesma página e mesma altura), da esquerda para a direita. */
export function linesFromTextItems(items: TextItem[], tolerance = 2.5): string[] {
  const byPage = new Map<number, TextItem[]>();
  items.filter((i) => i.str.trim()).forEach((i) => { const l = byPage.get(i.page) ?? []; l.push(i); byPage.set(i.page, l); });
  const out: string[] = [];
  Array.from(byPage.keys()).sort((a, b) => a - b).forEach((p) => {
    const rows: { y: number; items: TextItem[] }[] = [];
    // PDF: y cresce para cima; ordenamos de cima para baixo.
    byPage.get(p)!.sort((a, b) => b.y - a.y || a.x - b.x).forEach((it) => {
      const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance);
      if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
    });
    rows.sort((a, b) => b.y - a.y).forEach((r) => {
      const sorted = r.items.sort((a, b) => a.x - b.x);
      let line = "";
      let lastEnd: number | null = null;
      for (const it of sorted) {
        const gap = lastEnd === null ? 0 : it.x - lastEnd;
        line += lastEnd === null ? it.str : (gap > 8 ? "   " : gap > 1 ? " " : "") + it.str;
        lastEnd = it.x + (it.width ?? it.str.length * 4.5);
      }
      out.push(line.replace(/\s+$/, ""));
    });
  });
  return out;
}

const DATE_AT_START = /^\s*(\d{2})\/(\d{2})(?:\/(\d{2,4}))?(?=\s|$)/;
// Valor em formato brasileiro, com sinal antes/depois, D/C ou parênteses.
const MONEY = /(\(?-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?[-DC](?![A-Za-zÀ-ú]))?)/g;
const BALANCE_WORDS = /\bsaldo\b/i;
// Linhas de resumo do extrato (não são lançamentos).
const SUMMARY_WORDS = /^(total|totais|subtotal|resumo|soma)\b/i;
// Quadros de informação do extrato (limite, taxas, custo efetivo...): "Rótulo: valor", "(a.m.)", "%".
const INFO_LINE = /:\s*[(+\-]*\s*(R\$\s*)?\d|\((a\.m\.|a\.a\.)\)|%|\b(contratad[oa]|dispon[ií]vel|custo efetivo|cheque especial contratado|capital de giro)\b/i;

function moneyValue(token: string): number | null {
  const t = token.replace(/\s/g, "");
  const debit = /D$/.test(t) || /-$/.test(t) || /^\(?-/.test(t) || /^\(.*\)$/.test(t);
  const base = parseBrNumber(t.replace(/[DC]$/, "").replace(/^\((.*)\)$/, "$1").replace(/-/g, ""));
  if (base === null) return null;
  return debit ? -Math.abs(base) : Math.abs(base);
}

function yearOf(y: string | undefined, fallback: number): number {
  if (!y) return fallback;
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}

/**
 * Interpreta as linhas de um extrato:
 * - linha com data no início + valor = lançamento (descrição entre a data e o primeiro valor);
 * - linha com "saldo" = saldo (não é lançamento); o saldo da data mais recente vira o saldo do extrato;
 * - linha sem data, mas com valor, herda a data anterior (bancos que não repetem a data);
 * - linha sem data e sem valor logo após um lançamento complementa a descrição.
 */
export function parsePdfStatementLines(lines: string[]): ParsedStatement {
  const warnings: string[] = [];
  const all = lines.join("\n");
  const period = all.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|até|ate|-)\s*(\d{2}\/\d{2}\/\d{4})/i);
  const iso = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
  const periodStart = period ? iso(period[1]) : null;
  const periodEnd = period ? iso(period[2]) : null;
  const fallbackYear = periodEnd ? Number(periodEnd.slice(0, 4)) : new Date().getFullYear();

  const out: StatementLine[] = [];
  let lastDate: string | null = null;
  let last: StatementLine | null = null;
  let continuations = 0;
  let prevWasTx = false; // linha sem data só herda a data se vier logo após um lançamento
  let ledger: { date: string; balance: number } | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const dm = line.match(DATE_AT_START);
    let date: string | null = null;
    let rest = line;
    if (dm) {
      const year = yearOf(dm[3], fallbackYear);
      const mm = Number(dm[2]), dd = Number(dm[1]);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        date = `${year}-${dm[2]}-${dm[1]}`;
        rest = line.slice(dm[0].length).trim();
      }
    }
    const tokens = rest.match(MONEY) ?? [];
    if (!date && !lastDate) continue; // cabeçalho
    const useDate = date ?? lastDate!;

    if (SUMMARY_WORDS.test(rest) || INFO_LINE.test(rest)) { last = null; prevWasTx = false; continue; }
    if (BALANCE_WORDS.test(rest)) {
      const v = tokens.length ? moneyValue(tokens[tokens.length - 1]) : null;
      if (v !== null && (!ledger || useDate >= ledger.date)) ledger = { date: useDate, balance: v };
      if (date) lastDate = date;
      last = null;
      prevWasTx = !!date;
      continue;
    }
    if (!tokens.length) {
      // Complemento de descrição: no máximo 2 linhas curtas logo após o lançamento.
      if (!date && last && continuations < 2 && rest.length <= 80) { last.memo = `${last.memo} ${rest}`.trim(); continuations++; }
      else if (!date) last = null;
      if (date) lastDate = date;
      continue;
    }
    if (!date && !prevWasTx) { last = null; continue; } // valor solto fora da tabela de lançamentos
    // Com dois valores (valor e saldo), o lançamento é o penúltimo.
    const valueToken = tokens.length >= 2 ? tokens[tokens.length - 2] : tokens[0];
    const amount = moneyValue(valueToken);
    if (amount === null || amount === 0) continue;
    if (tokens.length >= 2) {
      const bal = moneyValue(tokens[tokens.length - 1]);
      if (bal !== null && (!ledger || useDate >= ledger.date)) ledger = { date: useDate, balance: bal };
    }
    const memo = rest.slice(0, rest.indexOf(tokens[0])).replace(/\s+/g, " ").trim();
    last = { date: useDate, amount: Math.round(amount * 100) / 100, memo: memo.slice(0, 140), fitid: null };
    continuations = 0;
    out.push(last);
    lastDate = useDate;
    prevWasTx = true;
  }

  if (!out.length) warnings.push("Não encontrei lançamentos no PDF. Se for um PDF escaneado (imagem), exporte o extrato em PDF de texto, OFX ou CSV.");
  out.sort((a, b) => a.date.localeCompare(b.date));
  return {
    source: "pdf",
    bankRef: null,
    periodStart: periodStart ?? out[0]?.date ?? null,
    periodEnd: periodEnd ?? out[out.length - 1]?.date ?? null,
    ledgerBalance: ledger ? ledger.balance : null,
    ledgerDate: ledger ? ledger.date : null,
    lines: out,
    warnings,
  };
}

/** Extrai as linhas de texto de um PDF no navegador. */
export async function extractPdfLines(data: ArrayBuffer): Promise<string[]> {
  const url = "/vendor/pdfjs/pdf.min.mjs";
  const pdfjs: any = await import(/* @vite-ignore */ url);
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      if (!it.str) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, page: p });
    }
  }
  await doc.destroy?.();
  return linesFromTextItems(items);
}
