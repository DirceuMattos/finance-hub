import { describe, it, expect } from "vitest";
import { getUserErrorMessage } from "@/lib/errorMessages";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });

  it("should not map row-level security errors as linked records", () => {
    expect(
      getUserErrorMessage({
        message: 'new row violates row-level security policy for table "system_parameters"',
      })
    ).toBe("Você não tem permissão para realizar esta operação no banco atual. Verifique se está logado no ambiente correto.");
  });
});
