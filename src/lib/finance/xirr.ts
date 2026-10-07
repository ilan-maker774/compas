import { Decimal, ZERO } from "./series";
import { daysBetween } from "../dates";

export type CashFlow = { date: string; amount: Decimal };

/**
 * Taux de rendement interne annualisé pour des flux datés (équivalent de XIRR dans Excel) :
 * trouve r tel que Σ montant_i / (1 + r)^(jours_i / 365) = 0.
 * Convention : versements de l'investisseur négatifs, encaissements et valeur finale positifs.
 * Renvoie null si le taux n'est pas défini (flux tous de même signe, pas de solution).
 */
export function xirr(flows: CashFlow[]): number | null {
  const nonZero = flows.filter((f) => !f.amount.isZero());
  if (nonZero.length < 2) return null;
  if (!nonZero.some((f) => f.amount.isNeg()) || !nonZero.some((f) => f.amount.isPos())) {
    return null;
  }
  const t0 = nonZero.reduce((min, f) => (f.date < min ? f.date : min), nonZero[0].date);
  const points = nonZero.map((f) => ({ t: daysBetween(t0, f.date) / 365, v: f.amount.toNumber() }));

  const npv = (r: number) => points.reduce((s, p) => s + p.v / Math.pow(1 + r, p.t), 0);
  const dnpv = (r: number) =>
    points.reduce((s, p) => s - (p.t * p.v) / Math.pow(1 + r, p.t + 1), 0);

  // Newton-Raphson depuis 10 %, comme Excel.
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(r);
    const d = dnpv(r);
    if (!Number.isFinite(f) || !Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (next <= -1) break;
    if (Math.abs(next - r) < 1e-12) return next;
    r = next;
  }

  // Repli : dichotomie sur ]-0,9999 ; 100], toujours convergente si le signe change.
  let lo = -0.9999;
  let hi = 100;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-10 || hi - lo < 1e-14) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export function sumFlows(flows: CashFlow[]) {
  return flows.reduce((s, f) => s.plus(f.amount), ZERO);
}
