import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const authState = { admin: false };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { app_metadata: { is_admin: authState.admin } }, session: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/supabaseClient", () => {
  const chain: any = {
    select: () => chain, eq: () => chain, is: () => chain, gte: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (res: any) => Promise.resolve({ data: [], error: null }).then(res),
  };
  return { supabase: { from: () => chain, rpc: () => Promise.resolve({ data: null, error: null }) } };
});

import { StatementImportPanel } from "./StatementImportPanel";

const renderPanel = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <StatementImportPanel
      accounts={[{ id: "a1", name: "Nu-Bank - PJ", opening_balance: 0, opening_balance_date: "2026-03-31", current_balance: 100 }]}
      byAccount={new Map()}
    />
  </QueryClientProvider>,
);

describe("StatementImportPanel", () => {
  it("só o administrador vê a importação", () => {
    authState.admin = false;
    renderPanel();
    expect(screen.getByText(/somente pelo administrador/)).toBeTruthy();
  });
  it("administrador vê conta, arquivo e saldo do extrato", () => {
    authState.admin = true;
    renderPanel();
    expect(screen.getByText(/Importar extrato do banco/)).toBeTruthy();
    expect(screen.getByLabelText("Arquivo")).toBeTruthy();
    expect(screen.getByText("Comparar")).toBeTruthy();
  });
});
