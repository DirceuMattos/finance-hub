import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutlookCards } from "./OutlookCards";

describe("OutlookCards", () => {
  it("mostra saldo previsto, contas negativas e situação dos cartões", () => {
    render(
      <OutlookCards
        monthLabel="outubro/26"
        outlookLoading={false}
        limitsLoading={false}
        outlook={{ current: -4925.81, incomePlanned: 4404.27, expensePlanned: 13329.28, overdueCount: 2, overdueNet: -300, projected: -13850.82, negatives: [{ name: "BRA - PF", balance: -10113.23 }] }}
        limits={[
          { name: "Itaú 2223 - Pessoal", entity_type: "personal", cycleStart: "2026-09-26", cycleEnd: "2026-10-25", invoice: 6868.22, ceiling: 3500, margin: -3368.22, pct: 1.96, level: "over", creditLimit: 0, openTotal: 30373.1, available: null },
          { name: "XP 7927 - Pessoal", entity_type: "personal", cycleStart: "2026-09-26", cycleEnd: "2026-10-25", invoice: 0, ceiling: 750, margin: 750, pct: 0, level: "ok", creditLimit: 5000, openTotal: 0, available: 5000 },
        ]}
      />,
    );
    expect(screen.getByText(/13\.850,82/)).toBeTruthy();
    expect(screen.getByText("BRA - PF")).toBeTruthy();
    expect(screen.getByText(/acima do teto em/)).toBeTruthy();
    expect(screen.getByText(/ainda cabe/)).toBeTruthy();
    expect(screen.getByText(/Inclui 2 previsto/)).toBeTruthy();
    expect(screen.getByText(/cadastre o limite/)).toBeTruthy();
  });

  it("mês encerrado não mostra previsão", () => {
    render(<OutlookCards monthLabel="setembro/26" outlookLoading={false} limitsLoading={false} outlook={null} limits={[]} />);
    expect(screen.getByText(/Mês encerrado/)).toBeTruthy();
  });
});
