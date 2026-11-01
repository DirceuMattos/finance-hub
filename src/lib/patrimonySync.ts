// Sugestões de fechamento do Patrimônio a partir de Investimentos e dos saldos das contas.
// Funções puras: a tela mostra a sugestão e só grava com confirmação do usuário.

export type SourceRule =
  | { kind: "investments"; classes: string[] }                  // soma das classes de Investimentos
  | { kind: "accounts"; names?: string[]; types?: string[] };   // soma dos saldos de contas (por nome ou tipo)

/** Vínculos padrão (por nome), definidos com o Dirceu em 01/11/2026. */
export const DEFAULT_RULES: Record<string, SourceRule> = {
  "Conta Internacional": { kind: "investments", classes: ["US$ - Dólar"] },
  "Sociedade Via Luz": { kind: "investments", classes: ["Investimento - Via Luz"] },
  "Bitcoins": { kind: "investments", classes: ["Bitcoins - Criptos Nu Bank"] },
  "Previdência Privada": { kind: "investments", classes: ["Previdência"] },
  "Fundos": { kind: "investments", classes: ["Fundos de Investimentos"] },
  "Investimentos Gerais - Renda Fixa, e outros": {
    kind: "investments",
    classes: ["COE - Estruturada", "Ações Nu Bank", "Ações em Bolsa", "Outros Produtos", "Financeiro (conta)"],
  },
  // Contas correntes da mesma entidade do item (pessoa física).
  "Contas Bancárias": { kind: "accounts", types: ["checking"] },
  "Poupanças": { kind: "accounts", names: ["BRA Poup", "XP - Digital"] },
};

export interface PatItem { id: string; item_name: string; financial_entity_id: string; closing_value: number | null }
export interface InvRow { className: string; financial_entity_id: string; closing_value: number | null }
export interface AccBalance {
  id: string; name: string; type: string | null; financial_entity_id: string;
  endBalance: number;          // saldo do app no último dia do mês (regra oficial)
  statement: number | null;    // saldo do extrato informado na Conciliação
}

export interface Suggestion {
  itemId: string;
  itemName: string;
  current: number | null;
  suggested: number;
  differs: boolean;
  sources: string[];       // composição (ex.: "COE - Estruturada R$ 188.036,33")
  pending: string[];       // o que ainda não está conferido/fechado
  complete: boolean;       // sem pendências
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const r2 = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function buildSuggestions(args: {
  items: PatItem[];
  investments: InvRow[];
  accounts: AccBalance[];
  rules?: Record<string, SourceRule>;
}): Suggestion[] {
  const rules = args.rules ?? DEFAULT_RULES;
  const ruleByName = new Map(Object.entries(rules).map(([k, v]) => [norm(k), v]));
  const out: Suggestion[] = [];

  for (const item of args.items) {
    const rule = ruleByName.get(norm(item.item_name));
    if (!rule) continue;
    const sources: string[] = [];
    const pending: string[] = [];
    let total = 0;
    let found = 0;

    if (rule.kind === "investments") {
      const wanted = new Set(rule.classes.map(norm));
      const rows = args.investments.filter((r) => r.financial_entity_id === item.financial_entity_id && wanted.has(norm(r.className)));
      for (const r of rows) {
        found++;
        if (r.closing_value === null || r.closing_value === undefined) { pending.push(`${r.className}: fechamento em aberto em Investimentos`); continue; }
        total += Number(r.closing_value);
        sources.push(`${r.className} ${brl(Number(r.closing_value))}`);
      }
      const missing = rule.classes.filter((c) => !rows.some((r) => norm(r.className) === norm(c)));
      if (missing.length && found === 0) continue; // nada lançado em Investimentos neste mês
      missing.forEach((c) => pending.push(`${c}: sem lançamento em Investimentos no mês`));
    } else {
      const names = rule.names ? new Set(rule.names.map(norm)) : null;
      const types = rule.types ? new Set(rule.types) : null;
      const accs = args.accounts.filter((a) =>
        (names ? names.has(norm(a.name)) : true) &&
        (types ? types.has(a.type ?? "") && a.financial_entity_id === item.financial_entity_id : true));
      if (!accs.length) continue;
      for (const a of accs) {
        found++;
        total += a.endBalance;
        sources.push(`${a.name} ${brl(a.endBalance)}`);
        if (a.statement === null) pending.push(`${a.name}: extrato do mês não conferido`);
        else if (Math.abs(a.statement - a.endBalance) >= 0.01) pending.push(`${a.name}: difere do extrato em ${brl(r2(a.endBalance - a.statement))}`);
      }
    }

    const suggested = r2(total);
    const current = item.closing_value === null || item.closing_value === undefined ? null : Number(item.closing_value);
    out.push({
      itemId: item.id,
      itemName: item.item_name,
      current,
      suggested,
      differs: current === null || Math.abs(current - suggested) >= 0.01,
      sources,
      pending,
      complete: pending.length === 0,
    });
  }
  return out.sort((a, b) => Number(b.differs) - Number(a.differs) || a.itemName.localeCompare(b.itemName));
}
