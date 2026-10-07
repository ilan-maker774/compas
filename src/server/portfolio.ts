import "server-only";
import { asc, eq, inArray, isNull, or } from "drizzle-orm";
import { fxRates, instruments, investmentAccounts, prices, transactions } from "@/db/schema";
import { addDays, addMonths, startOfYear, today } from "@/lib/dates";
import {
  allocate,
  annualize,
  benchmarkReturn,
  buildTimeline,
  moneyWeighted,
  monthlyDates,
  snapshot,
  twr,
} from "@/lib/finance/portfolio";
import { MissingFxRateError, ZERO } from "@/lib/finance/series";
import type { FxPoint, PortfolioData, PricePoint } from "@/lib/finance/types";
import { ACCOUNT_TYPE_LABELS, ASSET_CLASS_LABELS, REGION_LABELS } from "@/lib/labels";
import type { CurrentUser } from "./current-user";
import { db } from "./db";

export async function loadAccounts(userId: string) {
  return db
    .select()
    .from(investmentAccounts)
    .where(eq(investmentAccounts.userId, userId))
    .orderBy(asc(investmentAccounts.createdAt));
}

/** Instruments visibles par l'utilisateur : partagés + privés. */
export async function loadInstruments(userId: string) {
  return db
    .select()
    .from(instruments)
    .where(or(isNull(instruments.ownerUserId), eq(instruments.ownerUserId, userId)))
    .orderBy(asc(instruments.name));
}

export async function loadPortfolioData(user: CurrentUser) {
  const accounts = await loadAccounts(user.id);
  const accountIds = accounts.map((a) => a.id);
  const txs = accountIds.length
    ? await db
        .select()
        .from(transactions)
        .where(inArray(transactions.accountId, accountIds))
        .orderBy(asc(transactions.tradeDate))
    : [];

  const instrumentIds = new Set(txs.flatMap((t) => (t.instrumentId ? [t.instrumentId] : [])));
  if (user.benchmarkInstrumentId) instrumentIds.add(user.benchmarkInstrumentId);
  const insts = instrumentIds.size
    ? await db
        .select()
        .from(instruments)
        .where(inArray(instruments.id, [...instrumentIds]))
    : [];

  const priceRows = instrumentIds.size
    ? await db
        .select()
        .from(prices)
        .where(inArray(prices.instrumentId, [...instrumentIds]))
        .orderBy(asc(prices.date))
    : [];
  const priceMap = new Map<string, PricePoint[]>();
  for (const p of priceRows) {
    const list = priceMap.get(p.instrumentId) ?? [];
    list.push({ date: p.date, close: p.close, source: p.source });
    priceMap.set(p.instrumentId, list);
  }

  const currencies = [
    ...new Set([...insts.map((i) => i.currency), ...txs.map((t) => t.currency)]),
  ].filter((c) => c !== "EUR");
  const fxRows = currencies.length
    ? await db
        .select()
        .from(fxRates)
        .where(inArray(fxRates.currency, currencies))
        .orderBy(asc(fxRates.date))
    : [];
  const fxMap = new Map<string, FxPoint[]>();
  for (const r of fxRows) {
    const list = fxMap.get(r.currency) ?? [];
    list.push({ date: r.date, rate: r.rate, source: r.source });
    fxMap.set(r.currency, list);
  }

  const data: PortfolioData = {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
    instruments: insts.map((i) => ({
      id: i.id,
      name: i.name,
      currency: i.currency,
      valuationMode: i.valuationMode,
      assetClass: i.assetClass,
      region: i.region,
    })),
    transactions: txs,
    prices: priceMap,
    fxRates: fxMap,
  };
  return { data, accounts, instruments: insts, transactions: txs };
}

export type PeriodKey = "1M" | "6M" | "YTD" | "1Y" | "MAX";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "1M", label: "1 mois" },
  { key: "6M", label: "6 mois" },
  { key: "YTD", label: "Année en cours" },
  { key: "1Y", label: "12 mois" },
  { key: "MAX", label: "Depuis l'origine" },
];

/**
 * Tout ce qu'affichent le tableau de bord et la page portefeuille.
 * Les erreurs de données (taux de change manquant…) sont renvoyées comme constat,
 * jamais masquées par un chiffre approximatif.
 */
export async function computeOverview(user: CurrentUser, period: PeriodKey = "MAX") {
  const loaded = await loadPortfolioData(user);
  const { data, accounts, instruments: insts, transactions: txs } = loaded;
  const asOf = today();
  if (txs.length === 0) return { empty: true as const, accounts };

  try {
    const snap = snapshot(data, asOf);
    const firstDate = txs[0].tradeDate;
    const from =
      period === "MAX"
        ? addDays(firstDate, -1)
        : period === "YTD"
          ? addDays(startOfYear(asOf), -1)
          : addMonths(asOf, period === "1M" ? -1 : period === "6M" ? -6 : -12);
    const effectiveFrom = from < addDays(firstDate, -1) ? addDays(firstDate, -1) : from;

    const { points } = buildTimeline(data, monthlyDates(firstDate, asOf));
    const twrValue = twr(points, effectiveFrom, asOf);
    const mwr = moneyWeighted(points, effectiveFrom, asOf);
    const benchmark = user.benchmarkInstrumentId
      ? insts.find((i) => i.id === user.benchmarkInstrumentId)
      : undefined;
    const benchmarkValue = benchmark ? benchmarkReturn(data, benchmark, effectiveFrom, asOf) : null;

    const accountName = new Map(accounts.map((a) => [a.id, a.name]));
    const byAccount = (() => {
      const slices = allocate(snap.lines, ZERO, (l) => l.accountId, "");
      const map = new Map(slices.map((s) => [s.key, s.valueEur]));
      for (const [id, cash] of snap.cashByAccount) map.set(id, (map.get(id) ?? ZERO).plus(cash));
      const total = [...map.values()].reduce((s, v) => s.plus(v), ZERO);
      return [...map]
        .map(([key, valueEur]) => ({
          key,
          label: accountName.get(key) ?? key,
          valueEur,
          weight: total.isZero() ? 0 : valueEur.div(total).toNumber(),
        }))
        .sort((a, b) => b.valueEur.cmp(a.valueEur));
    })();

    const withLabels = (slices: ReturnType<typeof allocate>, labels: Record<string, string>) =>
      slices.map((s) => ({ ...s, label: labels[s.key] ?? s.key }));

    return {
      empty: false as const,
      asOf,
      period,
      from: effectiveFrom,
      accounts,
      snapshot: snap,
      timeline: points.map((p) => ({
        date: p.date,
        value: p.valueEur.toNumber(),
        invested: p.investedEur.toNumber(),
      })),
      performance: {
        twr: twrValue,
        twrAnnualized: twrValue === null ? null : annualize(twrValue, effectiveFrom, asOf),
        mwr,
        benchmark: benchmark ? { name: benchmark.name, value: benchmarkValue } : null,
      },
      allocation: {
        account: byAccount,
        assetClass: withLabels(
          allocate(snap.lines, snap.cashEur, (l) => l.instrument.assetClass, "liquidites"),
          ASSET_CLASS_LABELS,
        ),
        region: withLabels(
          allocate(
            snap.lines,
            snap.cashEur,
            (l) => l.instrument.region ?? "non_renseigne",
            "liquidites",
          ),
          REGION_LABELS,
        ),
        currency: allocate(snap.lines, snap.cashEur, (l) => l.instrument.currency, "EUR").map(
          (s) => ({
            ...s,
            label: s.key,
          }),
        ),
      },
      accountTypeLabels: ACCOUNT_TYPE_LABELS,
    };
  } catch (err) {
    if (err instanceof MissingFxRateError) {
      return { empty: true as const, accounts, error: err.message };
    }
    throw err;
  }
}
