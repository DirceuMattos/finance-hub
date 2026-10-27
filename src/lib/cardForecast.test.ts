import { describe, expect, it } from "vitest";
import { isForecast, splitForecast, withForecastTag } from "./cardForecast";

describe("previsões em cartão", () => {
  it("reconhece recorrência e marcação", () => {
    expect(isForecast({ source_type: "recurrence" })).toBe(true);
    expect(isForecast({ source_type: "migration", tags: ["previsao"] })).toBe(true);
    expect(isForecast({ source_type: "manual", tags: ["outra"] })).toBe(false);
    expect(isForecast({})).toBe(false);
  });

  it("liga e desliga a marcação preservando outras tags", () => {
    expect(withForecastTag(["a"], true)).toEqual(["a", "previsao"]);
    expect(withForecastTag(["a", "previsao"], true)).toEqual(["a", "previsao"]);
    expect(withForecastTag(["a", "previsao"], false)).toEqual(["a"]);
    expect(withForecastTag(["previsao"], false)).toBeNull();
    expect(withForecastTag(null, false)).toBeNull();
  });

  it("separa empenhado e previsto", () => {
    expect(splitForecast([
      { amount: 100 }, { amount: 550, source_type: "recurrence" }, { amount: 70.89, tags: ["previsao"] }, { amount: 20.1 },
    ])).toEqual({ committed: 120.1, forecast: 620.89, forecastCount: 2 });
  });
});
