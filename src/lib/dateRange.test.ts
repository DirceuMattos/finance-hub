import { describe, expect, it } from "vitest";
import { inRange, validateRange } from "./dateRange";

describe("validateRange (LAN-02)", () => {
  it("vazio é permitido", () => expect(validateRange("2026-10", "", "").ok).toBe(true));
  it("datas dentro do mês", () => expect(validateRange("2026-10", "2026-10-05", "2026-10-20").ok).toBe(true));
  it("só a data inicial", () => expect(validateRange("2026-10", "2026-10-05", "").ok).toBe(true));
  it("bloqueia data fora do mês", () => {
    const r = validateRange("2026-10", "2026-09-30", "2026-10-10");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("30/09/2026");
    expect(r.error).toContain("10/2026");
  });
  it("bloqueia final fora do mês", () => expect(validateRange("2026-10", "2026-10-01", "2026-11-01").ok).toBe(false));
  it("bloqueia inicial depois da final", () => expect(validateRange("2026-10", "2026-10-20", "2026-10-05").error).toContain("posterior"));
  it("bloqueia datas sem mês escolhido", () => expect(validateRange("all", "2026-10-01", "").ok).toBe(false));
  it("bloqueia data inexistente", () => expect(validateRange("2026-02", "2026-02-30", "").ok).toBe(false));
});

describe("inRange", () => {
  const row = (due: string | null, comp: string | null = "2026-10-01") => ({ due_date: due, competence_date: comp });
  it("usa vencimento", () => {
    expect(inRange(row("2026-10-10"), "2026-10-05", "2026-10-15")).toBe(true);
    expect(inRange(row("2026-10-20"), "2026-10-05", "2026-10-15")).toBe(false);
  });
  it("sem vencimento usa competência", () => expect(inRange(row(null, "2026-10-01"), "2026-10-01", "2026-10-02")).toBe(true));
  it("limites inclusivos", () => expect(inRange(row("2026-10-15"), "2026-10-15", "2026-10-15")).toBe(true));
});
