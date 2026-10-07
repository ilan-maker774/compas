import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, schema } from "../../src/db";
import { loadDemoData } from "../../src/db/demo";
import { runDailyUpdate } from "../../src/lib/jobs/daily";
import type { FxProvider, PriceProvider } from "../../src/lib/market-data";
import { snapshot } from "../../src/lib/finance/portfolio";
import type { PortfolioData } from "../../src/lib/finance/types";

process.loadEnvFile?.(".env");
const { db, pool } = createDb(process.env.TEST_DATABASE_URL);
afterAll(() => pool.end());
beforeEach(async () => {
  await pool.query(
    "TRUNCATE users, instruments, investment_accounts, transactions, prices, fx_rates, theses CASCADE",
  );
});

describe("tâche quotidienne", () => {
  it("récupère les cours manquants et les taux BCE, puis replanifie les revues après résultats", async () => {
    const [user] = await db.insert(schema.users).values({ email: "j@test.fr" }).returning();
    const [account] = await db
      .insert(schema.investmentAccounts)
      .values({ userId: user.id, type: "cto", name: "CTO" })
      .returning();
    const [msft] = await db
      .insert(schema.instruments)
      .values({
        name: "Microsoft",
        type: "action",
        assetClass: "actions",
        currency: "USD",
        providerRefs: { fake: "MSFT" },
      })
      .returning();
    await db.insert(schema.transactions).values({
      accountId: account.id,
      instrumentId: msft.id,
      type: "achat",
      tradeDate: "2026-10-01",
      quantity: "1",
      unitPrice: "400",
      currency: "USD",
    });
    await db
      .insert(schema.prices)
      .values({ instrumentId: msft.id, date: "2026-10-01", close: "400", source: "fake" });
    const [thesis] = await db
      .insert(schema.theses)
      .values({
        userId: user.id,
        instrumentId: msft.id,
        thesisText: "…",
        conviction: 3,
        reviewOnEarnings: true,
        nextReviewOn: "2027-01-01",
      })
      .returning();

    const calls: string[] = [];
    const priceProvider: PriceProvider = {
      id: "fake",
      async getDailyCloses(ref, from, to) {
        calls.push(`${ref} ${from} ${to}`);
        return [
          { date: "2026-10-02", close: "405" },
          { date: "2026-10-05", close: "410" },
        ];
      },
      async getNextEarningsDate() {
        return "2026-10-28";
      },
    };
    const fxProvider: FxProvider = {
      id: "ecb",
      async getRates(currencies) {
        return currencies.map((currency) => ({ date: "2026-10-05", currency, rate: "1.17" }));
      },
    };

    const report = await runDailyUpdate(db, { priceProvider, fxProvider, today: "2026-10-06" });
    expect(calls).toEqual(["MSFT 2026-10-02 2026-10-06"]);
    expect(report.prices).toEqual([{ instrument: "Microsoft", inserted: 2 }]);
    expect(report.fx.inserted).toBe(1);
    expect(report.reviewsRescheduled).toBe(1);
    const [updated] = await db.select().from(schema.theses).where(eq(schema.theses.id, thesis.id));
    expect(updated.nextReviewOn).toBe("2026-10-29");
  });
});

describe("données de démonstration", () => {
  it("se chargent et se valorisent sans anomalie", async () => {
    const [user] = await db.insert(schema.users).values({ email: "demo@test.fr" }).returning();
    await loadDemoData(db, user.id, "2026-10-06");
    const accounts = await db
      .select()
      .from(schema.investmentAccounts)
      .where(eq(schema.investmentAccounts.userId, user.id));
    const txs = await db.select().from(schema.transactions);
    const insts = await db.select().from(schema.instruments);
    const priceRows = await db.select().from(schema.prices);
    const fx = await db.select().from(schema.fxRates);
    const prices = new Map<string, { date: string; close: string; source: string }[]>();
    for (const p of priceRows.sort((a, b) => a.date.localeCompare(b.date))) {
      prices.set(p.instrumentId, [...(prices.get(p.instrumentId) ?? []), p]);
    }
    const data: PortfolioData = {
      accounts,
      instruments: insts,
      transactions: txs,
      prices,
      fxRates: new Map([["USD", fx.sort((a, b) => a.date.localeCompare(b.date))]]),
    };
    const s = snapshot(data, "2026-10-06");
    expect(s.warnings).toEqual([]);
    expect(s.cashEur.toNumber()).toBeGreaterThan(0);
    expect(s.totalEur.toNumber()).toBeGreaterThan(40000);
  });
});
