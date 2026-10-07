/** Utilitaires de dates au format AAAA-MM-JJ, sans fuseau horaire (UTC). */

const MS_PER_DAY = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return toIso(new Date());
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * MS_PER_DAY));
}

/** Ajoute des mois en ramenant au dernier jour du mois si besoin (31/01 + 1 mois = 28/02). */
export function addMonths(iso: string, months: number): string {
  const d = toDate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toIso(target);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / MS_PER_DAY);
}

/** Derniers jours de chaque mois strictement entre `from` et `to`, puis `to`. */
export function monthEndsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const start = toDate(from);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  while (toIso(cursor) < to) {
    if (toIso(cursor) >= from) out.push(toIso(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 2, 0));
  }
  out.push(to);
  return out;
}

export function startOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}
