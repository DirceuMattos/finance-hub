import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./calc";

describe("evaluateExpression", () => {
  it.each([
    ["1+2", 3],
    ["1.234,56 + 10", 1244.56],
    ["1234.56-0.56", 1234],
    ["2*(3+4)", 14],
    ["-5+10", 5],
    ["100/3", 33.33],
    ["10 x 2", 20],
    ["3027,40 - 1500", 1527.4],
  ])("%s = %s", (e, v) => expect(evaluateExpression(e)).toBe(v));

  it.each(["", "1+", "(1+2", "1/0", "abc", "alert(1)", "1++2"])("inválido: %s", (e) => {
    expect(evaluateExpression(e)).toBeNull();
  });
});
