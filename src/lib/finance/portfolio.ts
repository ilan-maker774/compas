import { addDays, daysBetween, monthEndsBetween } from "../dates";
import { Ledger, sortTransactions, type HoldingValuation } from "./ledger";
import { Decimal, FxTable, ZERO, dec, lastPrice } from "./series";
import type { PortfolioData } from "./types";
import { xirr, type CashFlow } from "./xirr";

export type TimelinePoint = {
  date: string;
  valueEur: Decimal;
  /** Flux externes nets de la journée (apports positifs). */
  flowEur: Decimal;
  /** Capital net investi cumulé. */
  investedEur: Decimal;
};

/**
 * Valeur du portefeuille à chaque date demandée et à chaque date de flux externe
 * (ces dernières sont indispensables pour un TWR exact).
 */
export function buildTimeline(data: PortfolioData, dates: string[], accountIds?: string[]) {
  const fx = new FxTable(data.fxRates);
  const scoped = accountIds
    ? data.transactions.filter((t) => accountIds.includes(t.accountId))
    : data.transactions;
  const txs = sortTransactions(scoped);
  const ledger = new Ledger({ instruments: data.instruments, transactions: txs }, fx);

  const allDates = new Set(dates);
  // Les dates de flux sont connues après application ; on les obtient avec un premier passage.
  const probe = new Ledger({ instruments: data.instruments, transactions: txs }, fx);
  for (const tx of txs) probe.apply(tx);
  for (const f of probe.flows) allDates.add(f.date);
  const sorted = [...allDates].sort();

  const points: TimelinePoint[] = [];
  let i = 0;
  let invested = ZERO;
  for (const date of sorted) {
    const flowsBefore = ledger.flows.length;
    while (i < txs.length && txs[i].tradeDate <= date) ledger.apply(txs[i++]);
    const flow = ledger.flows.slice(flowsBefore).reduce((s, f) => s.plus(f.amountEur), ZERO);
    invested = invested.plus(flow);
    points.push({
      date,
      valueEur: ledger.valuation(date, data.prices).totalEur,
      flowEur: flow,
      investedEur: invested,
    });
  }
  return { points, flows: probe.flows, ledger };
}

/** Valorisation détaillée et agrégats à une date. */
export function snapshot(data: PortfolioData, date: string) {
  const fx = new FxTable(data.fxRates);
  const txs = sortTransactions(data.transactions.filter((t) => t.tradeDate <= date));
  const ledger = new Ledger({ instruments: data.instruments, transactions: txs }, fx);
  for (const tx of txs) ledger.apply(tx);
  const valuation = ledger.valuation(date, data.prices);
  const cashByAccount = [...ledger.cash].filter(([id]) => ledger.isCashTracked(id));
  return {
    date,
    ...valuation,
    cashByAccount: new Map(cashByAccount),
    costEur: valuation.lines.reduce((s, l) => s.plus(l.costEur), ZERO),
    unrealizedEur: valuation.lines.reduce((s, l) => s.plus(l.unrealizedEur), ZERO),
    realizedEur: ledger.realizedEur,
    incomeEur: ledger.incomeEur,
    feesEur: ledger.feesEur,
    taxesEur: ledger.taxesEur,
    netInvestedEur: ledger.flows.reduce((s, f) => s.plus(f.amountEur), ZERO),
    warnings: ledger.warnings,
  };
}

export type Snapshot = ReturnType<typeof snapshot>;

/**
 * Performance pondérée par le temps sur ]from ; to].
 * Les flux sont supposés intervenir à la clôture : la valeur juste avant le flux du jour i
 * vaut V_i − F_i, d'où r_i = (V_i − F_i) / V_{i−1} − 1, puis chaînage des sous-périodes.
 * Il faut donc une valorisation à chaque date de flux (assuré par buildTimeline).
 */
export function twr(points: TimelinePoint[], from: string, to: string): number | null {
  const start = lastBefore(points, from);
  let prevValue = start?.valueEur ?? ZERO;
  let growth = new Decimal(1);
  let any = false;
  for (const p of points) {
    if (p.date <= from || p.date > to) continue;
    if (prevValue.gt(0)) {
      growth = growth.mul(p.valueEur.minus(p.flowEur).div(prevValue));
      any = true;
    }
    prevValue = p.valueEur;
  }
  return any ? growth.minus(1).toNumber() : null;
}

/** Performance pondérée par l'argent (TRI annualisé) sur ]from ; to]. */
export function moneyWeighted(points: TimelinePoint[], from: string, to: string): number | null {
  const start = lastBefore(points, from);
  const flows: CashFlow[] = [];
  if (start && start.valueEur.gt(0)) flows.push({ date: from, amount: start.valueEur.neg() });
  for (const p of points) {
    if (p.date <= from || p.date > to || p.flowEur.isZero()) continue;
    flows.push({ date: p.date, amount: p.flowEur.neg() });
  }
  const end = lastBefore(points, addDays(to, 1));
  if (end) flows.push({ date: to, amount: end.valueEur });
  return xirr(flows);
}

/** Rendement d'un indice ou d'un fonds de référence entre deux dates, converti en euros. */
export function benchmarkReturn(
  data: PortfolioData,
  instrument: { id: string; currency: string },
  from: string,
  to: string,
): number | null {
  const fx = new FxTable(data.fxRates);
  const series = data.prices.get(instrument.id);
  const a = lastPrice(series, from) ?? series?.[0];
  const b = lastPrice(series, to);
  if (!a || !b || a.date >= b.date) return null;
  try {
    const va = fx.toEur(dec(a.close), instrument.currency, a.date);
    const vb = fx.toEur(dec(b.close), instrument.currency, b.date);
    return vb.div(va).minus(1).toNumber();
  } catch {
    return null;
  }
}

export function annualize(cumulative: number, from: string, to: string): number | null {
  const days = daysBetween(from, to);
  if (days < 365) return null;
  return Math.pow(1 + cumulative, 365 / days) - 1;
}

/** Points de fin de mois pour les graphiques (horizon minimal affiché : le mois). */
export function monthlyDates(firstDate: string, asOf: string) {
  return monthEndsBetween(firstDate, asOf);
}

function lastBefore(points: TimelinePoint[], date: string): TimelinePoint | undefined {
  let found: TimelinePoint | undefined;
  for (const p of points) {
    if (p.date <= date) found = p;
    else break;
  }
  return found;
}

// ---------------------------------------------------------------------------
// Répartition
// ---------------------------------------------------------------------------

export type AllocationSlice = { key: string; valueEur: Decimal; weight: number };

export function allocate(
  lines: HoldingValuation[],
  cashEur: Decimal,
  keyOf: (l: HoldingValuation) => string,
  cashKey: string,
): AllocationSlice[] {
  const map = new Map<string, Decimal>();
  for (const l of lines) map.set(keyOf(l), (map.get(keyOf(l)) ?? ZERO).plus(l.valueEur));
  if (!cashEur.isZero()) map.set(cashKey, (map.get(cashKey) ?? ZERO).plus(cashEur));
  const total = [...map.values()].reduce((s, v) => s.plus(v), ZERO);
  return [...map]
    .map(([key, valueEur]) => ({
      key,
      valueEur,
      weight: total.isZero() ? 0 : valueEur.div(total).toNumber(),
    }))
    .sort((a, b) => b.valueEur.cmp(a.valueEur));
}
