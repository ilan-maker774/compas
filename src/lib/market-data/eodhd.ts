import type { DailyClose, PriceProvider } from "./types";

/** EOD Historical Data — https://eodhd.com/financial-apis/ (référence du type « CW8.PA »). */
export class EodhdProvider implements PriceProvider {
  readonly id = "eodhd";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getDailyCloses(ref: string, from: string, to: string): Promise<DailyClose[]> {
    const url = new URL(`https://eodhd.com/api/eod/${encodeURIComponent(ref)}`);
    url.search = new URLSearchParams({ api_token: this.apiKey, from, to, fmt: "json" }).toString();
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`EODHD ${ref} : HTTP ${res.status}`);
    const rows = (await res.json()) as { date: string; close: number }[];
    return rows.filter((r) => r.close > 0).map((r) => ({ date: r.date, close: String(r.close) }));
  }

  async getNextEarningsDate(ref: string, from: string): Promise<string | null> {
    const url = new URL("https://eodhd.com/api/calendar/earnings");
    url.search = new URLSearchParams({
      api_token: this.apiKey,
      symbols: ref,
      from,
      fmt: "json",
    }).toString();
    const res = await this.fetchImpl(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { earnings?: { report_date: string }[] };
    const dates = (body.earnings ?? [])
      .map((e) => e.report_date)
      .filter((d) => d >= from)
      .sort();
    return dates[0] ?? null;
  }
}
