import { describe, expect, it } from "vitest";
import { buildSuggestions, type AccBalance, type InvRow, type PatItem } from "./patrimonySync";

const PF = "pf", PJ = "pj";
const items: PatItem[] = [
  { id: "1", item_name: "Conta Internacional", financial_entity_id: PF, closing_value: null },
  { id: "2", item_name: "Investimentos Gerais - Renda Fixa, e outros", financial_entity_id: PF, closing_value: 190566.46 },
  { id: "3", item_name: "Contas Bancárias", financial_entity_id: PF, closing_value: null },
  { id: "4", item_name: "Poupanças", financial_entity_id: PF, closing_value: 0 },
  { id: "5", item_name: "Imóvel - Residência", financial_entity_id: PF, closing_value: 1050000 },
  { id: "6", item_name: "Fundos", financial_entity_id: PF, closing_value: null },
];
const inv: InvRow[] = [
  { className: "US$ - Dólar", financial_entity_id: PF, closing_value: 56680.88 },
  { className: "COE - Estruturada", financial_entity_id: PF, closing_value: 188036.33 },
  { className: "Ações Nu Bank", financial_entity_id: PF, closing_value: 2527.2 },
  { className: "Ações em Bolsa", financial_entity_id: PF, closing_value: 0 },
  { className: "Outros Produtos", financial_entity_id: PF, closing_value: 0 },
  { className: "Financeiro (conta)", financial_entity_id: PF, closing_value: 2.93 },
];
const acc: AccBalance[] = [
  { id: "a", name: "BRA - PF", type: "checking", financial_entity_id: PF, endBalance: -2000, statement: -2000 },
  { id: "b", name: "Itaú - PF", type: "checking", financial_entity_id: PF, endBalance: -1060.41, statement: null },
  { id: "c", name: "Nu-Bank - PJ", type: "checking", financial_entity_id: PJ, endBalance: 9000, statement: 9000 },
  { id: "d", name: "BRA Poup", type: "savings", financial_entity_id: PF, endBalance: 723.37, statement: 723.37 },
  { id: "e", name: "XP - Digital", type: "investment", financial_entity_id: PF, endBalance: 35.23, statement: 40 },
];

describe("buildSuggestions", () => {
  const s = buildSuggestions({ items, investments: inv, accounts: acc });
  const by = (n: string) => s.find((x) => x.itemName === n)!;

  it("investimento 1:1 e soma de várias classes", () => {
    expect(by("Conta Internacional")).toMatchObject({ suggested: 56680.88, differs: true, complete: true });
    expect(by("Investimentos Gerais - Renda Fixa, e outros")).toMatchObject({ suggested: 190566.46, differs: false, complete: true });
  });

  it("contas correntes só da mesma entidade, com pendência do extrato", () => {
    const c = by("Contas Bancárias");
    expect(c.suggested).toBe(-3060.41);
    expect(c.complete).toBe(false);
    expect(c.pending[0]).toContain("Itaú - PF");
    expect(c.sources.join()).not.toContain("Nu-Bank - PJ");
  });

  it("poupanças por nome, apontando diferença do extrato", () => {
    const p = by("Poupanças");
    expect(p.suggested).toBe(758.6);
    expect(p.pending[0]).toContain("XP - Digital");
  });

  it("itens sem vínculo ou sem lançamento na origem ficam de fora", () => {
    expect(s.some((x) => x.itemName === "Imóvel - Residência")).toBe(false);
    expect(s.some((x) => x.itemName === "Fundos")).toBe(false);
  });

  it("ignora acentos e maiúsculas no nome do item", () => {
    const r = buildSuggestions({ items: [{ id: "x", item_name: "contas bancarias", financial_entity_id: PF, closing_value: null }], investments: [], accounts: acc });
    expect(r[0].suggested).toBe(-3060.41);
  });
});
