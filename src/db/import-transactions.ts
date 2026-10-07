/**
 * Import CSV définitif, indépendant de Next.js (testé dans tests/db/import.test.ts).
 */
import { createHash } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from ".";
import { importBatches, instruments, investmentAccounts, transactions } from "./schema";
import {
  IMPORT_FIELDS,
  parseRow,
  rowFingerprint,
  type ImportField,
  type ParsedRow,
} from "../lib/csv-import";

export type ImportResult = {
  error?: string;
  imported?: number;
  duplicates?: number;
  rejected?: { line: number; errors: string[] }[];
  createdInstruments?: string[];
};

const payloadSchema = z.object({
  accountId: z.string().uuid(),
  fileName: z.string().max(200),
  mapping: z.partialRecord(
    z.enum(IMPORT_FIELDS.map((f) => f.key) as [ImportField, ...ImportField[]]),
    z.string(),
  ),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  // Les lignes plus courtes que l'en-tête ont des cellules absentes : on les ramène à "".
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .max(20000)
    .transform((rows) =>
      rows.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" ? v : ""])),
      ),
    ),
});

/**
 * Import définitif. Le serveur revalide chaque ligne (l'aperçu du navigateur n'est qu'indicatif),
 * rapproche les titres par ISIN puis ticker puis libellé, et ignore les lignes déjà importées.
 */
export async function importTransactions(
  db: Db,
  userId: string,
  payload: unknown,
): Promise<ImportResult> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Fichier ou correspondance de colonnes invalide." };
  const { accountId, fileName, mapping, defaultCurrency, rows } = parsed.data;

  const [account] = await db
    .select()
    .from(investmentAccounts)
    .where(and(eq(investmentAccounts.id, accountId), eq(investmentAccounts.userId, userId)));
  if (!account) return { error: "Compte introuvable." };
  if (!mapping.date) return { error: "La colonne « Date » est obligatoire." };

  const valid: { line: number; row: ParsedRow }[] = [];
  const rejected: ImportResult["rejected"] = [];
  rows.forEach((raw, i) => {
    const r = parseRow(raw, mapping, defaultCurrency);
    if (r.ok) valid.push({ line: i + 2, row: r.row });
    else rejected.push({ line: i + 2, errors: r.errors });
  });

  const visible = await db
    .select()
    .from(instruments)
    .where(or(isNull(instruments.ownerUserId), eq(instruments.ownerUserId, userId)));
  const byIsin = new Map(visible.filter((i) => i.isin).map((i) => [i.isin!, i]));
  const byTicker = new Map(
    visible.filter((i) => i.ticker).map((i) => [i.ticker!.toUpperCase(), i]),
  );
  const byName = new Map(visible.map((i) => [i.name.toLowerCase(), i]));
  const createdInstruments: string[] = [];

  const result = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(importBatches)
      .values({ accountId, fileName, columnMapping: mapping, rowCount: rows.length })
      .returning();

    let imported = 0;
    let duplicates = 0;
    // Deux lignes identiques dans un même fichier sont deux opérations distinctes : on les numérote.
    const seen = new Map<string, number>();
    for (const { row } of valid) {
      let instrumentId: string | null = null;
      if (row.isin || row.ticker || row.name) {
        let inst =
          (row.isin && byIsin.get(row.isin)) ||
          (row.ticker && byTicker.get(row.ticker.toUpperCase())) ||
          (row.name && byName.get(row.name.toLowerCase())) ||
          undefined;
        if (!inst && ["achat", "vente", "dividende", "interets"].includes(row.type)) {
          [inst] = await tx
            .insert(instruments)
            .values({
              name: row.name ?? row.ticker ?? row.isin!,
              isin: row.isin,
              ticker: row.ticker,
              type: "action",
              assetClass: "actions",
              currency: row.currency,
              country: row.isin ? row.isin.slice(0, 2) : null,
              ownerUserId: userId,
            })
            .returning();
          createdInstruments.push(inst.name);
          if (inst.isin) byIsin.set(inst.isin, inst);
          if (inst.ticker) byTicker.set(inst.ticker.toUpperCase(), inst);
          byName.set(inst.name.toLowerCase(), inst);
        }
        instrumentId = inst?.id ?? null;
      }
      const fp = rowFingerprint(row);
      const n = (seen.get(fp) ?? 0) + 1;
      seen.set(fp, n);
      const externalRef = createHash("sha256").update(`${fp}#${n}`).digest("hex").slice(0, 32);
      const isTrade = row.type === "achat" || row.type === "vente";
      const inserted = await tx
        .insert(transactions)
        .values({
          accountId,
          instrumentId: ["versement", "retrait"].includes(row.type) ? null : instrumentId,
          type: row.type,
          tradeDate: row.tradeDate,
          quantity: isTrade ? row.quantity : null,
          unitPrice: isTrade ? row.unitPrice : null,
          amount: isTrade ? null : row.amount,
          fees: row.fees,
          taxes: row.taxes,
          currency: row.currency,
          fxRateToEur: row.fxRateToEur,
          importBatchId: batch.id,
          externalRef,
        })
        .onConflictDoNothing()
        .returning({ id: transactions.id });
      if (inserted.length) imported++;
      else duplicates++;
    }
    return { imported, duplicates };
  });

  return { ...result, rejected, createdInstruments };
}
