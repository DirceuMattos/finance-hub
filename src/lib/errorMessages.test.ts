import { describe, expect, it, vi } from "vitest";
import { getUserErrorMessage } from "./errorMessages";

describe("getUserErrorMessage", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  it("sessão vencida ou encerrada vira orientação para entrar de novo", () => {
    expect(getUserErrorMessage({ code: "PGRST301", message: "JWT expired" })).toContain("sessão expirou");
    expect(getUserErrorMessage({ message: "Invalid Refresh Token: Refresh Token Not Found" })).toContain("sessão expirou");
  });
  it("falha de rede tem mensagem própria", () => {
    expect(getUserErrorMessage(new TypeError("Failed to fetch"))).toContain("Sem resposta do servidor");
  });
  it("demais erros seguem genéricos", () => {
    expect(getUserErrorMessage({ message: "algo estranho" })).toBe("Ocorreu um erro inesperado. Tente novamente.");
  });
});
