import { describe, expect, it } from "vitest";
import { formatCountdown, idleState, startingActivity, IDLE_LIMIT_MS, IDLE_WARNING_MS } from "./idleSession";

const MIN = 60_000;

describe("idleState", () => {
  it("ativo até 12 min, aviso entre 12 e 15 min, expira aos 15", () => {
    expect(idleState(11 * MIN, 0).phase).toBe("active");
    expect(idleState(12 * MIN, 0)).toEqual({ phase: "warning", remaining: 3 * MIN });
    expect(idleState(14 * MIN + 30_000, 0)).toEqual({ phase: "warning", remaining: 30_000 });
    expect(idleState(15 * MIN, 0)).toEqual({ phase: "expired", remaining: 0 });
    expect(idleState(60 * MIN, 0).phase).toBe("expired"); // computador suspenso
  });

  it("limites padrão", () => {
    expect(IDLE_LIMIT_MS).toBe(15 * MIN);
    expect(IDLE_WARNING_MS).toBe(3 * MIN);
  });
});

describe("startingActivity", () => {
  it("usa a mais recente entre atividade guardada e último login", () => {
    expect(startingActivity(1000, 5000, 9000)).toBe(5000);
    expect(startingActivity(7000, 5000, 9000)).toBe(7000);
  });
  it("sem registro começa agora; ignora valores no futuro", () => {
    expect(startingActivity(null, null, 9000)).toBe(9000);
    expect(startingActivity(99999, null, 9000)).toBe(9000);
  });
});

describe("formatCountdown", () => {
  it.each([[180_000, "3:00"], [179_001, "3:00"], [59_000, "0:59"], [0, "0:00"]])("%d ms → %s", (ms, txt) => {
    expect(formatCountdown(ms)).toBe(txt);
  });
});
