// Calculadora segura para o modal de quitação: + - * / e parênteses, sem eval.
// Aceita vírgula ou ponto decimal ("1.234,56", "1234.56", "1234,56").

type Tok = { t: "n"; v: number } | { t: "op"; v: string } | { t: "(" } | { t: ")" };

function parseNumber(raw: string): number {
  let s = raw;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error("Número inválido");
  return n;
}

function tokenize(expr: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(\d[\d.,]*|[+\-*/()])/y;
  let i = 0;
  const src = expr.replace(/[x×]/g, "*").replace(/÷/g, "/");
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error("Caractere inválido");
    const tok = m[1];
    if (/^\d/.test(tok)) out.push({ t: "n", v: parseNumber(tok) });
    else if (tok === "(") out.push({ t: "(" });
    else if (tok === ")") out.push({ t: ")" });
    else out.push({ t: "op", v: tok });
    i = re.lastIndex;
  }
  return out;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3 };

/** Avalia a expressão; retorna null quando vazia ou inválida. */
export function evaluateExpression(expr: string): number | null {
  if (!expr || !expr.trim()) return null;
  try {
    const toks = tokenize(expr);
    const output: (number | string)[] = [];
    const ops: string[] = [];
    let prev: Tok | null = null;
    for (const tk of toks) {
      if (tk.t === "n") output.push(tk.v);
      else if (tk.t === "(") ops.push("(");
      else if (tk.t === ")") {
        while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
        if (ops.pop() !== "(") return null;
      } else {
        const unary = tk.v === "-" && (!prev || prev.t === "op" || prev.t === "(");
        const op = unary ? "u-" : tk.v;
        if (!unary && (!prev || prev.t === "op" || prev.t === "(")) return null;
        while (ops.length && ops[ops.length - 1] !== "(" &&
          (op === "u-" ? PREC[ops[ops.length - 1]] > PREC[op] : PREC[ops[ops.length - 1]] >= PREC[op])) {
          output.push(ops.pop()!);
        }
        ops.push(op);
      }
      prev = tk;
    }
    while (ops.length) {
      const op = ops.pop()!;
      if (op === "(") return null;
      output.push(op);
    }
    const st: number[] = [];
    for (const x of output) {
      if (typeof x === "number") { st.push(x); continue; }
      if (x === "u-") { if (!st.length) return null; st.push(-st.pop()!); continue; }
      const b = st.pop(); const a = st.pop();
      if (a === undefined || b === undefined) return null;
      if (x === "+") st.push(a + b);
      else if (x === "-") st.push(a - b);
      else if (x === "*") st.push(a * b);
      else if (x === "/") { if (b === 0) return null; st.push(a / b); }
    }
    if (st.length !== 1 || !Number.isFinite(st[0])) return null;
    return Math.round(st[0] * 100) / 100;
  } catch {
    return null;
  }
}
