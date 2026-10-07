import { addDays, addMonths } from "./dates";
import { dec } from "./finance/series";

export type Operator = "gt" | "gte" | "lt" | "lte";

export const OPERATOR_LABELS: Record<Operator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

export type MetricStatus = "respecte" | "franchi" | "inconnu";

/**
 * Un indicateur exprime ce que la thèse attend (« marge opérationnelle > 15 % »).
 * Il est « franchi » quand la valeur actuelle ne respecte plus cette condition : c'est un constat,
 * pas une invitation à agir.
 */
export function evaluateMetric(
  operator: Operator,
  threshold: string,
  currentValue: string | null,
): MetricStatus {
  if (currentValue === null || currentValue === "") return "inconnu";
  const v = dec(currentValue);
  const t = dec(threshold);
  const ok =
    operator === "gt"
      ? v.gt(t)
      : operator === "gte"
        ? v.gte(t)
        : operator === "lt"
          ? v.lt(t)
          : v.lte(t);
  return ok ? "respecte" : "franchi";
}

/**
 * Prochaine revue : la plus proche entre « dernière revue + N mois » et
 * « lendemain de la prochaine publication de résultats » (si l'option est activée).
 */
export function nextReviewDate(opts: {
  lastReviewOn: string;
  intervalMonths: number | null;
  nextEarningsOn?: string | null;
}): string | null {
  const candidates: string[] = [];
  if (opts.intervalMonths) candidates.push(addMonths(opts.lastReviewOn, opts.intervalMonths));
  if (opts.nextEarningsOn && opts.nextEarningsOn >= opts.lastReviewOn) {
    candidates.push(addDays(opts.nextEarningsOn, 1));
  }
  return candidates.sort()[0] ?? null;
}

export const MAX_METRICS_PER_THESIS = 3;
