// Previsões em cartão (ex.: Supermercado semanal, aplicativos): valores estimados que entram na
// fatura até a compra real ser lançada/conferida. Contam no total, mas aparecem destacados.

export const FORECAST_TAG = "previsao";

export function isForecast(t: { source_type?: string | null; tags?: string[] | null }): boolean {
  return t.source_type === "recurrence" || (t.tags ?? []).includes(FORECAST_TAG);
}

/** Liga/desliga a marcação de previsão preservando as demais tags. */
export function withForecastTag(tags: string[] | null | undefined, on: boolean): string[] | null {
  const rest = (tags ?? []).filter((t) => t !== FORECAST_TAG);
  const out = on ? [...rest, FORECAST_TAG] : rest;
  return out.length ? out : null;
}

export interface ForecastSplit { committed: number; forecast: number; forecastCount: number }

/** Separa o total em compras empenhadas e previsões. */
export function splitForecast(items: { amount: number; source_type?: string | null; tags?: string[] | null }[]): ForecastSplit {
  let committed = 0, forecast = 0, forecastCount = 0;
  for (const i of items) {
    const v = Math.abs(Number(i.amount) || 0);
    if (isForecast(i)) { forecast += v; forecastCount++; } else committed += v;
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { committed: r2(committed), forecast: r2(forecast), forecastCount };
}
