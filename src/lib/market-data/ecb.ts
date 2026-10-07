import Papa from "papaparse";
import type { FxObservation, FxProvider } from "./types";

/**
 * Taux de change de référence de la Banque centrale européenne (gratuits, publiés vers 16 h
 * les jours ouvrés). https://data.ecb.europa.eu/help/api/data
 */
export class EcbFxProvider implements FxProvider {
  readonly id = "ecb";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getRates(currencies: string[], from: string, to: string): Promise<FxObservation[]> {
    const wanted = currencies.filter((c) => c !== "EUR");
    if (wanted.length === 0) return [];
    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${wanted.join("+")}.EUR.SP00.A?startPeriod=${from}&endPeriod=${to}&format=csvdata`;
    const res = await this.fetchImpl(url);
    if (res.status === 404) return []; // aucune observation sur la période (week-end)
    if (!res.ok) throw new Error(`BCE : HTTP ${res.status}`);
    return parseEcbCsv(await res.text());
  }
}

export function parseEcbCsv(csv: string): FxObservation[] {
  const { data } = Papa.parse<Record<string, string>>(csv.trim(), { header: true });
  return data
    .filter((r) => r.OBS_VALUE && r.TIME_PERIOD && r.CURRENCY)
    .map((r) => ({ date: r.TIME_PERIOD, currency: r.CURRENCY, rate: r.OBS_VALUE }));
}
