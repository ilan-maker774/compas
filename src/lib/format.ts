import type Decimal from "decimal.js";

type Num = number | Decimal | string | null | undefined;
const toNumber = (v: Num) =>
  v === null || v === undefined ? null : typeof v === "number" ? v : Number(v.toString());

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(v: Num, opts: { decimals?: boolean; sign?: boolean } = {}) {
  const n = toNumber(v);
  if (n === null || Number.isNaN(n)) return "—";
  const s = (opts.decimals === false ? eur0 : eur).format(n);
  return opts.sign && n > 0 ? `+${s}` : s;
}

export function formatMoney(v: Num, currency: string) {
  const n = toNumber(v);
  if (n === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 4,
  }).format(n);
}

export function formatPct(v: Num, opts: { sign?: boolean; digits?: number } = {}) {
  const n = toNumber(v);
  if (n === null || Number.isNaN(n)) return "—";
  const s = new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: opts.digits ?? 2,
    maximumFractionDigits: opts.digits ?? 2,
  }).format(n);
  return opts.sign && n > 0 ? `+${s}` : s;
}

export function formatQty(v: Num) {
  const n = toNumber(v);
  if (n === null) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(n);
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatNumber(v: Num, digits = 2) {
  const n = toNumber(v);
  if (n === null) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(n);
}
