import Decimal from "decimal.js";
import type { FxPoint, PricePoint } from "./types";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export { Decimal };
export const ZERO = new Decimal(0);
export const dec = (v: string | number | null | undefined) => new Decimal(v ?? 0);

/** Dernier point dont la date est ≤ `date` (recherche dichotomique). */
export function lastOnOrBefore<T extends { date: string }>(points: T[] | undefined, date: string) {
  if (!points || points.length === 0) return undefined;
  let lo = 0;
  let hi = points.length - 1;
  let found: T | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].date <= date) {
      found = points[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export class FxTable {
  constructor(private readonly rates: Map<string, FxPoint[]>) {}

  /**
   * Taux 1 EUR = x devise à la date donnée (dernier taux BCE publié à cette date).
   * Lève une erreur si aucun taux n'est disponible : mieux vaut un calcul absent qu'un calcul faux.
   */
  rate(currency: string, date: string): { rate: Decimal; date: string; source: string } {
    if (currency === "EUR") return { rate: new Decimal(1), date, source: "identité" };
    const point = lastOnOrBefore(this.rates.get(currency), date);
    if (!point) throw new MissingFxRateError(currency, date);
    return { rate: dec(point.rate), date: point.date, source: point.source };
  }

  toEur(amount: Decimal, currency: string, date: string, explicitRate?: string | null) {
    if (currency === "EUR") return amount;
    const rate = explicitRate ? dec(explicitRate) : this.rate(currency, date).rate;
    return amount.div(rate);
  }
}

export class MissingFxRateError extends Error {
  constructor(
    public readonly currency: string,
    public readonly date: string,
  ) {
    super(`Aucun taux de change ${currency} disponible au ${date}`);
  }
}

export function lastPrice(points: PricePoint[] | undefined, date: string) {
  return lastOnOrBefore(points, date);
}
