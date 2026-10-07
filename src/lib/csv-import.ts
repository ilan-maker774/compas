/**
 * Import CSV : correspondance des colonnes, normalisation et validation ligne à ligne.
 * Code partagé entre le navigateur (aperçu) et le serveur (import définitif, qui revalide tout).
 */
import Decimal from "decimal.js";
import type { TransactionType } from "./finance/types";

export const IMPORT_FIELDS = [
  { key: "date", label: "Date", required: true },
  { key: "type", label: "Type d'opération", required: false },
  { key: "isin", label: "ISIN", required: false },
  { key: "ticker", label: "Ticker", required: false },
  { key: "name", label: "Libellé / nom du titre", required: false },
  { key: "quantity", label: "Quantité", required: false },
  { key: "unitPrice", label: "Prix unitaire", required: false },
  { key: "amount", label: "Montant", required: false },
  { key: "fees", label: "Frais", required: false },
  { key: "taxes", label: "Taxes / impôts", required: false },
  { key: "currency", label: "Devise", required: false },
  { key: "fxRate", label: "Taux de change (1 EUR = x)", required: false },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** Champ cible → nom de colonne du fichier. */
export type ColumnMapping = Partial<Record<ImportField, string>>;

const SYNONYMS: Record<ImportField, string[]> = {
  date: [
    "date",
    "date operation",
    "date d'operation",
    "date d'execution",
    "trade date",
    "date de valeur",
  ],
  type: ["type", "operation", "sens", "nature", "type d'operation", "transaction", "action"],
  isin: ["isin", "code isin"],
  ticker: ["ticker", "symbole", "symbol", "mnemo", "mnemonique"],
  name: ["nom", "libelle", "valeur", "titre", "name", "instrument", "produit", "support"],
  quantity: ["quantite", "qte", "quantity", "nombre", "nb titres", "shares", "parts"],
  unitPrice: ["prix", "cours", "prix unitaire", "price", "cours d'execution", "prix d'execution"],
  amount: ["montant", "montant net", "amount", "total", "montant brut"],
  fees: ["frais", "commission", "courtage", "fees", "frais de courtage"],
  taxes: ["taxes", "taxe", "impots", "ttf", "retenue", "tax", "withholding tax"],
  currency: ["devise", "currency", "monnaie"],
  fxRate: ["taux de change", "change", "fx rate", "exchange rate"],
};

export function normalizeLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim();
}

/** Propose une correspondance à partir des en-têtes du fichier. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const synonyms = SYNONYMS[field.key];
    const exact = headers.find((h) => !used.has(h) && synonyms.includes(normalizeLabel(h)));
    const partial =
      exact ??
      headers.find(
        (h) => !used.has(h) && synonyms.some((s) => s.length > 3 && normalizeLabel(h).includes(s)),
      );
    if (partial) {
      mapping[field.key] = partial;
      used.add(partial);
    }
  }
  return mapping;
}

const TYPE_LABELS: [TransactionType, string[]][] = [
  [
    "achat",
    [
      "achat",
      "buy",
      "acquisition",
      "souscription",
      "achat comptant",
      "purchase",
      "savings plan",
      "investissement",
    ],
  ],
  ["vente", ["vente", "sell", "cession", "rachat", "vente comptant", "sale", "arbitrage sortant"]],
  ["dividende", ["dividende", "dividend", "distribution", "coupon dividende", "dividendes"]],
  ["interets", ["interets", "interet", "interest", "coupon", "participation aux benefices"]],
  ["frais", ["frais", "fee", "fees", "droits de garde", "frais de gestion", "commission"]],
  ["taxe", ["taxe", "tax", "impot", "prelevements sociaux", "prelevement"]],
  [
    "versement",
    [
      "versement",
      "depot",
      "deposit",
      "apport",
      "virement entrant",
      "versement libre",
      "versement programme",
    ],
  ],
  ["retrait", ["retrait", "withdrawal", "virement sortant", "rachat partiel"]],
];

export function normalizeType(label: string): TransactionType | null {
  const n = normalizeLabel(label);
  if (!n) return null;
  for (const [type, labels] of TYPE_LABELS) if (labels.includes(n)) return type;
  for (const [type, labels] of TYPE_LABELS) if (labels.some((l) => n.startsWith(l))) return type;
  return null;
}

/** « 1 234,56 », « 1.234,56 », « 1,234.56 », « -12.5 € » → chaîne décimale. */
export function parseNumber(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  let s = raw.replace(/[\s  €$£%]|EUR|USD|GBP|CHF/gi, "").trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur est le séparateur décimal.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  }
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
  return new Decimal(s).toString();
}

/** « 07/01/2025 », « 07-01-2025 », « 07.01.2025 », « 2025-01-07 » (format français JJ/MM). */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().slice(0, 10);
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return date.toISOString().slice(0, 10);
}

export type ParsedRow = {
  tradeDate: string;
  type: TransactionType;
  isin: string | null;
  ticker: string | null;
  name: string | null;
  quantity: string | null;
  unitPrice: string | null;
  amount: string | null;
  fees: string;
  taxes: string;
  currency: string;
  fxRateToEur: string | null;
};

export type RowResult = { ok: true; row: ParsedRow } | { ok: false; errors: string[] };

const abs = (v: string | null) => (v === null ? null : new Decimal(v).abs().toString());

export function parseRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  defaultCurrency = "EUR",
): RowResult {
  const get = (f: ImportField) => (mapping[f] ? (raw[mapping[f]!] ?? "").trim() : "");
  const errors: string[] = [];

  const tradeDate = parseDate(get("date"));
  if (!tradeDate) errors.push(`Date illisible : « ${get("date")} »`);

  const rawQuantity = parseNumber(get("quantity"));
  let type = mapping.type ? normalizeType(get("type")) : null;
  if (!type && !mapping.type && rawQuantity) {
    // Sans colonne « type », le signe de la quantité indique le sens.
    type = new Decimal(rawQuantity).isNeg() ? "vente" : "achat";
  }
  if (!type) errors.push(`Type d'opération non reconnu : « ${get("type")} »`);

  const isin = get("isin").toUpperCase() || null;
  if (isin && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) errors.push(`ISIN invalide : « ${isin} »`);

  const quantity = abs(rawQuantity);
  let unitPrice = abs(parseNumber(get("unitPrice")));
  const amount = abs(parseNumber(get("amount")));
  const fees = abs(parseNumber(get("fees"))) ?? "0";
  const taxes = abs(parseNumber(get("taxes"))) ?? "0";
  const currency = (get("currency") || defaultCurrency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.push(`Devise invalide : « ${currency} »`);
  const fxRateToEur = parseNumber(get("fxRate"));

  const ticker = get("ticker") || null;
  const name = get("name") || null;
  const hasInstrument = Boolean(isin || ticker || name);

  if (type === "achat" || type === "vente") {
    if (!hasInstrument) errors.push("Titre non identifié (ISIN, ticker ou libellé requis)");
    if (!quantity || new Decimal(quantity).isZero()) errors.push("Quantité manquante");
    if (!unitPrice && amount && quantity && !new Decimal(quantity).isZero()) {
      // Prix déduit du montant brut quand le fichier ne donne que le total.
      unitPrice = new Decimal(amount).div(quantity).toString();
    }
    if (!unitPrice) errors.push("Prix unitaire manquant");
  } else if (type === "dividende" || type === "interets") {
    if (!hasInstrument) errors.push("Titre non identifié pour ce revenu");
    if (!amount) errors.push("Montant manquant");
  } else if (type) {
    if (!amount || new Decimal(amount).isZero()) errors.push("Montant manquant");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    row: {
      tradeDate: tradeDate!,
      type: type!,
      isin,
      ticker,
      name,
      quantity: type === "achat" || type === "vente" ? quantity : null,
      unitPrice: type === "achat" || type === "vente" ? unitPrice : null,
      amount: type === "achat" || type === "vente" ? null : amount,
      fees,
      taxes,
      currency,
      fxRateToEur: fxRateToEur && new Decimal(fxRateToEur).gt(0) ? fxRateToEur : null,
    },
  };
}

/** Clé de déduplication : même contenu normalisé = même opération. */
export function rowFingerprint(row: ParsedRow): string {
  return [
    row.tradeDate,
    row.type,
    row.isin ?? row.ticker ?? row.name ?? "",
    row.quantity ?? "",
    row.unitPrice ?? "",
    row.amount ?? "",
    row.fees,
    row.taxes,
    row.currency,
  ].join("|");
}
