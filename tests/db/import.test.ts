import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, schema } from "../../src/db";
import { importTransactions } from "../../src/db/import-transactions";
import { guessMapping } from "../../src/lib/csv-import";

process.loadEnvFile?.(".env");
const { db, pool } = createDb(process.env.TEST_DATABASE_URL);
afterAll(() => pool.end());

beforeEach(async () => {
  await pool.query(
    "TRUNCATE users, instruments, investment_accounts, transactions, import_batches CASCADE",
  );
});

const headers = [
  "Date d'opération",
  "Opération",
  "Code ISIN",
  "Libellé",
  "Quantité",
  "Cours",
  "Frais",
  "Montant net",
  "Devise",
];
const row = (values: string[]) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
const rows = [
  row([
    "03/03/2025",
    "ACHAT COMPTANT",
    "FR0000120271",
    "TOTALENERGIES",
    "20",
    "61,35",
    "2,50",
    "-1229,50",
    "EUR",
  ]),
  row(["12/06/2025", "DIVIDENDE", "FR0000120271", "TOTALENERGIES", "", "", "", "15,80", "EUR"]),
  // Deux achats identiques le même jour : deux opérations distinctes.
  row([
    "02/09/2025",
    "ACHAT COMPTANT",
    "NL0010273215",
    "ASML HOLDING",
    "1",
    "640,10",
    "2,50",
    "",
    "EUR",
  ]),
  row([
    "02/09/2025",
    "ACHAT COMPTANT",
    "NL0010273215",
    "ASML HOLDING",
    "1",
    "640,10",
    "2,50",
    "",
    "EUR",
  ]),
  row(["01/10/2025", "Opération inconnue", "", "", "", "", "", "10", "EUR"]),
  { "Date d'opération": "05/10/2025", Opération: "Versement" } as Record<string, string>, // ligne courte
];

async function setup() {
  const [user] = await db.insert(schema.users).values({ email: "imp@test.fr" }).returning();
  const [account] = await db
    .insert(schema.investmentAccounts)
    .values({ userId: user.id, type: "cto", name: "CTO" })
    .returning();
  return { user, account };
}

describe("import CSV", () => {
  it("importe, crée les titres manquants et rejette les lignes invalides", async () => {
    const { user, account } = await setup();
    const payload = {
      accountId: account.id,
      fileName: "courtier.csv",
      mapping: guessMapping(headers),
      defaultCurrency: "EUR",
      rows,
    };
    const result = await importTransactions(db, user.id, payload);
    expect(result.error).toBeUndefined();
    expect(result.imported).toBe(4);
    expect(result.rejected).toHaveLength(2);
    expect(result.createdInstruments).toEqual(["TOTALENERGIES", "ASML HOLDING"]);
    const txs = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.accountId, account.id));
    expect(txs.map((t) => t.type).sort()).toEqual(["achat", "achat", "achat", "dividende"]);
  });

  it("ne crée aucun doublon lors d'un réimport", async () => {
    const { user, account } = await setup();
    const payload = {
      accountId: account.id,
      fileName: "courtier.csv",
      mapping: guessMapping(headers),
      defaultCurrency: "EUR",
      rows,
    };
    await importTransactions(db, user.id, payload);
    const again = await importTransactions(db, user.id, payload);
    expect(again.imported).toBe(0);
    expect(again.duplicates).toBe(4);
  });

  it("refuse d'importer dans le compte d'un autre utilisateur", async () => {
    const { account } = await setup();
    const [other] = await db.insert(schema.users).values({ email: "autre@test.fr" }).returning();
    const result = await importTransactions(db, other.id, {
      accountId: account.id,
      fileName: "x.csv",
      mapping: { date: "Date d'opération" },
      defaultCurrency: "EUR",
      rows,
    });
    expect(result.error).toBe("Compte introuvable.");
  });

  it("rapproche les titres existants par ISIN", async () => {
    const { user, account } = await setup();
    await db.insert(schema.instruments).values({
      isin: "FR0000120271",
      name: "TotalEnergies SE",
      type: "action",
      assetClass: "actions",
      currency: "EUR",
    });
    const result = await importTransactions(db, user.id, {
      accountId: account.id,
      fileName: "x.csv",
      mapping: guessMapping(headers),
      defaultCurrency: "EUR",
      rows: rows.slice(0, 2),
    });
    expect(result.createdInstruments).toEqual([]);
  });
});
