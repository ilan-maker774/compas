/**
 * Tâche quotidienne : mise à jour des cours de clôture et des taux BCE, puis des dates de revue
 * des thèses liées aux publications de résultats. Aucune notification liée aux cours.
 */
import { and, eq, isNotNull, max, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { fxRates, instruments, prices, theses, transactions, users } from "@/db/schema";
import { addDays, addMonths } from "../dates";
import type { FxProvider, PriceProvider } from "../market-data";

export type DailyReport = {
  prices: { instrument: string; inserted: number; error?: string }[];
  fx: { inserted: number; error?: string };
  reviewsRescheduled: number;
};

export async function runDailyUpdate(
  db: Db,
  opts: { priceProvider: PriceProvider | null; fxProvider: FxProvider | null; today: string },
): Promise<DailyReport> {
  const report: DailyReport = { prices: [], fx: { inserted: 0 }, reviewsRescheduled: 0 };

  // Instruments utiles : détenus (au moins une transaction) ou choisis comme benchmark.
  const used = await db
    .select()
    .from(instruments)
    .where(
      sql`${instruments.id} IN (SELECT ${transactions.instrumentId} FROM ${transactions})
          OR ${instruments.id} IN (SELECT ${users.benchmarkInstrumentId} FROM ${users})`,
    );
  const firstTx = await db
    .select({ d: sql<string>`min(${transactions.tradeDate})` })
    .from(transactions);
  const defaultFrom = firstTx[0]?.d ?? addMonths(opts.today, -12);

  if (opts.priceProvider) {
    const provider = opts.priceProvider;
    for (const inst of used) {
      const ref = inst.providerRefs[provider.id];
      if (!ref || inst.valuationMode === "nominal") continue;
      const [last] = await db
        .select({ d: max(prices.date) })
        .from(prices)
        .where(eq(prices.instrumentId, inst.id));
      const from = last?.d ? addDays(last.d, 1) : defaultFrom;
      if (from > opts.today) continue;
      try {
        const rows = await provider.getDailyCloses(ref, from, opts.today);
        if (rows.length) {
          await db
            .insert(prices)
            .values(
              rows.map((r) => ({
                instrumentId: inst.id,
                date: r.date,
                close: r.close,
                source: provider.id,
              })),
            )
            .onConflictDoNothing();
        }
        report.prices.push({ instrument: inst.name, inserted: rows.length });
      } catch (err) {
        report.prices.push({ instrument: inst.name, inserted: 0, error: String(err) });
      }
    }
  }

  if (opts.fxProvider) {
    const currencies = [...new Set(used.map((i) => i.currency))].filter((c) => c !== "EUR");
    if (currencies.length) {
      const [last] = await db.select({ d: max(fxRates.date) }).from(fxRates);
      const from = last?.d ? addDays(last.d, 1) : defaultFrom;
      try {
        if (from <= opts.today) {
          const rows = await opts.fxProvider.getRates(currencies, from, opts.today);
          if (rows.length) {
            await db
              .insert(fxRates)
              .values(rows.map((r) => ({ ...r, source: opts.fxProvider!.id })))
              .onConflictDoNothing();
          }
          report.fx.inserted = rows.length;
        }
      } catch (err) {
        report.fx.error = String(err);
      }
    }
  }

  const provider = opts.priceProvider;
  if (provider?.getNextEarningsDate) {
    const rows = await db
      .select({ thesis: theses, instrument: instruments })
      .from(theses)
      .innerJoin(instruments, eq(theses.instrumentId, instruments.id))
      .where(
        and(
          eq(theses.status, "active"),
          eq(theses.reviewOnEarnings, true),
          isNotNull(instruments.providerRefs),
        ),
      );
    for (const { thesis, instrument } of rows) {
      const ref = instrument.providerRefs[provider.id];
      if (!ref) continue;
      const earnings = await provider.getNextEarningsDate(ref, opts.today).catch(() => null);
      if (!earnings) continue;
      const target = addDays(earnings, 1);
      if (!thesis.nextReviewOn || target < thesis.nextReviewOn) {
        await db.update(theses).set({ nextReviewOn: target }).where(eq(theses.id, thesis.id));
        report.reviewsRescheduled++;
      }
    }
  }

  return report;
}
