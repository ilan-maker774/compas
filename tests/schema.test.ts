import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, schema } from "../src/db";
import { deleteUserData } from "../src/db/user-data";

process.loadEnvFile?.(".env");
const { db, pool } = createDb(process.env.TEST_DATABASE_URL);

afterAll(() => pool.end());

beforeEach(async () => {
  await pool.query(
    `TRUNCATE users, instruments, investment_accounts, transactions, prices, fx_rates,
     import_batches, theses, thesis_metrics, thesis_reviews, thesis_closures CASCADE`,
  );
});

async function fixture() {
  const [user] = await db.insert(schema.users).values({ email: "a@test.fr" }).returning();
  const [account] = await db
    .insert(schema.investmentAccounts)
    .values({ userId: user.id, type: "cto", name: "CTO" })
    .returning();
  const [stock] = await db
    .insert(schema.instruments)
    .values({
      isin: "US5949181045",
      name: "Microsoft",
      type: "action",
      assetClass: "actions",
      currency: "USD",
    })
    .returning();
  return { user, account, stock };
}

/** Drizzle enveloppe l'erreur Postgres : on vérifie le nom de la contrainte violée. */
async function expectViolation(promise: Promise<unknown>, constraint: string) {
  await expect(promise).rejects.toMatchObject({ cause: { constraint } });
}

describe("instruments", () => {
  it("refuse un ISIN mal formé", async () => {
    await expectViolation(
      db.insert(schema.instruments).values({
        isin: "FR123",
        name: "X",
        type: "action",
        assetClass: "actions",
        currency: "EUR",
      }),
      "instruments_isin_format",
    );
  });

  it("impose la valorisation nominale au fonds euros", async () => {
    await expectViolation(
      db.insert(schema.instruments).values({
        name: "Fonds euros",
        type: "fonds_euros",
        assetClass: "fonds_euros",
        currency: "EUR",
      }),
      "instruments_fonds_euros_nominal",
    );
  });

  it("n'autorise qu'un instrument partagé par ISIN, mais permet des copies privées", async () => {
    const { user } = await fixture();
    const base = {
      isin: "US5949181045",
      name: "Microsoft",
      type: "action" as const,
      assetClass: "actions" as const,
      currency: "USD",
    };
    await expectViolation(db.insert(schema.instruments).values(base), "instruments_isin_shared_uq");
    await expect(
      db.insert(schema.instruments).values({ ...base, ownerUserId: user.id }),
    ).resolves.toBeDefined();
  });
});

describe("transactions", () => {
  it("exige instrument, quantité et prix pour un achat", async () => {
    const { account } = await fixture();
    await expectViolation(
      db.insert(schema.transactions).values({
        accountId: account.id,
        type: "achat",
        tradeDate: "2025-01-02",
        currency: "EUR",
      }),
      "transactions_trade_fields",
    );
  });

  it("refuse une quantité nulle ou négative", async () => {
    const { account, stock } = await fixture();
    await expectViolation(
      db.insert(schema.transactions).values({
        accountId: account.id,
        instrumentId: stock.id,
        type: "vente",
        tradeDate: "2025-01-02",
        quantity: "-1",
        unitPrice: "100",
        currency: "USD",
      }),
      "transactions_trade_fields",
    );
  });

  it("refuse un versement rattaché à un instrument", async () => {
    const { account, stock } = await fixture();
    await expectViolation(
      db.insert(schema.transactions).values({
        accountId: account.id,
        instrumentId: stock.id,
        type: "versement",
        tradeDate: "2025-01-02",
        amount: "1000",
        currency: "EUR",
      }),
      "transactions_cash_fields",
    );
  });

  it("refuse des frais négatifs", async () => {
    const { account } = await fixture();
    await expectViolation(
      db.insert(schema.transactions).values({
        accountId: account.id,
        type: "versement",
        tradeDate: "2025-01-02",
        amount: "1000",
        fees: "-1",
        currency: "EUR",
      }),
      "transactions_fees_non_negative",
    );
  });

  it("conserve la précision des montants et des quantités", async () => {
    const { account, stock } = await fixture();
    const [tx] = await db
      .insert(schema.transactions)
      .values({
        accountId: account.id,
        instrumentId: stock.id,
        type: "achat",
        tradeDate: "2025-01-02",
        quantity: "0.1234567891",
        unitPrice: "390.12345678",
        fxRateToEur: "1.0540123456",
        currency: "USD",
      })
      .returning();
    expect(tx.quantity).toBe("0.1234567891");
    expect(tx.unitPrice).toBe("390.12345678");
    expect(tx.fxRateToEur).toBe("1.0540123456");
  });
});

describe("taux de change", () => {
  it("refuse un taux EUR/EUR (l'euro est la devise de base)", async () => {
    await expectViolation(
      db.insert(schema.fxRates).values({ date: "2025-01-02", currency: "EUR", rate: "1" }),
      "fx_rates_not_eur",
    );
  });
});

describe("journal de thèse", () => {
  it("borne la conviction entre 1 et 5", async () => {
    const { user, stock } = await fixture();
    await expectViolation(
      db.insert(schema.theses).values({
        userId: user.id,
        instrumentId: stock.id,
        thesisText: "…",
        conviction: 6,
      }),
      "theses_conviction_range",
    );
  });

  it("n'autorise qu'une clôture par thèse", async () => {
    const { user, stock } = await fixture();
    const [thesis] = await db
      .insert(schema.theses)
      .values({ userId: user.id, instrumentId: stock.id, thesisText: "…", conviction: 3 })
      .returning();
    const closure = {
      thesisId: thesis.id,
      closedOn: "2026-01-01",
      saleReason: "Objectif atteint",
      thesisValidated: "oui" as const,
      assessment: "…",
    };
    await db.insert(schema.thesisClosures).values(closure);
    await expectViolation(
      db.insert(schema.thesisClosures).values(closure),
      "thesis_closures_thesis_id_unique",
    );
  });
});

describe("suppression de compte (RGPD)", () => {
  it("efface toutes les données de l'utilisateur et conserve les instruments partagés", async () => {
    const { user, account, stock } = await fixture();
    const [privateFund] = await db
      .insert(schema.instruments)
      .values({
        name: "Fonds euros",
        type: "fonds_euros",
        assetClass: "fonds_euros",
        currency: "EUR",
        valuationMode: "nominal",
        ownerUserId: user.id,
      })
      .returning();
    await db.insert(schema.transactions).values([
      {
        accountId: account.id,
        instrumentId: stock.id,
        type: "achat",
        tradeDate: "2025-01-02",
        quantity: "1",
        unitPrice: "400",
        currency: "USD",
      },
      {
        accountId: account.id,
        instrumentId: privateFund.id,
        type: "achat",
        tradeDate: "2025-01-02",
        quantity: "1000",
        unitPrice: "1",
        currency: "EUR",
      },
    ]);
    const [thesis] = await db
      .insert(schema.theses)
      .values({ userId: user.id, instrumentId: privateFund.id, thesisText: "…", conviction: 2 })
      .returning();
    await db
      .insert(schema.thesisMetrics)
      .values({ thesisId: thesis.id, name: "Rendement", operator: "gte", threshold: "2.5" });

    await deleteUserData(db, user.id);

    const counts = await pool.query(`
      SELECT (SELECT count(*) FROM users) AS users,
             (SELECT count(*) FROM investment_accounts) AS accounts,
             (SELECT count(*) FROM transactions) AS transactions,
             (SELECT count(*) FROM theses) AS theses,
             (SELECT count(*) FROM thesis_metrics) AS metrics`);
    expect(counts.rows[0]).toEqual({
      users: "0",
      accounts: "0",
      transactions: "0",
      theses: "0",
      metrics: "0",
    });
    const remaining = await db.select().from(schema.instruments);
    expect(remaining.map((i) => i.id)).toEqual([stock.id]);
    expect(
      await db.select().from(schema.instruments).where(eq(schema.instruments.id, privateFund.id)),
    ).toEqual([]);
  });
});
