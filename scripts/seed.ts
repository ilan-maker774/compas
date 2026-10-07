/**
 * Données de démonstration : un utilisateur avec un PEA, un CTO et une assurance-vie,
 * quelques transactions (dont une en USD) et une thèse active.
 * Les cours et taux de change sont fictifs.
 */
import { and, eq, isNull } from "drizzle-orm";
import { createDb, schema, type Db } from "../src/db";
import { deleteUserData } from "../src/db/user-data";

async function main() {
  const { db, pool } = createDb();

  const [previous] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "demo@compas.local"));
  if (previous) await deleteUserData(db, previous.id);

  const [user] = await db
    .insert(schema.users)
    .values({ email: "demo@compas.local", name: "Démo", preferences: { theme: "system" } })
    .returning();

  const msciWorld = await upsertSharedInstrument(db, {
    isin: "LU1681043599",
    ticker: "CW8",
    exchangeMic: "XPAR",
    name: "Amundi MSCI World UCITS ETF",
    type: "etf",
    assetClass: "actions",
    currency: "EUR",
    country: "LU",
    region: "monde",
    providerRefs: { eodhd: "CW8.PA" },
  });
  const lvmh = await upsertSharedInstrument(db, {
    isin: "FR0000121014",
    ticker: "MC",
    exchangeMic: "XPAR",
    name: "LVMH Moët Hennessy Louis Vuitton",
    type: "action",
    assetClass: "actions",
    currency: "EUR",
    country: "FR",
    region: "france",
    sector: "Consommation discrétionnaire",
    providerRefs: { eodhd: "MC.PA" },
  });
  const microsoft = await upsertSharedInstrument(db, {
    isin: "US5949181045",
    ticker: "MSFT",
    exchangeMic: "XNAS",
    name: "Microsoft Corp.",
    type: "action",
    assetClass: "actions",
    currency: "USD",
    country: "US",
    region: "amerique_du_nord",
    sector: "Technologies de l'information",
    providerRefs: { eodhd: "MSFT.US" },
  });
  const [fondsEuros] = await db
    .insert(schema.instruments)
    .values({
      name: "Fonds euros (contrat démo)",
      type: "fonds_euros",
      assetClass: "fonds_euros",
      currency: "EUR",
      valuationMode: "nominal",
      ownerUserId: user.id,
    })
    .returning();

  await db
    .update(schema.users)
    .set({ benchmarkInstrumentId: msciWorld.id })
    .where(eq(schema.users.id, user.id));

  const [pea, cto, av] = await db
    .insert(schema.investmentAccounts)
    .values([
      { userId: user.id, type: "pea", name: "PEA", institution: "Courtier A" },
      { userId: user.id, type: "cto", name: "CTO", institution: "Courtier B" },
      { userId: user.id, type: "assurance_vie", name: "Assurance-vie", institution: "Assureur C" },
    ])
    .returning();

  await db.insert(schema.transactions).values([
    {
      accountId: pea.id,
      type: "versement",
      tradeDate: "2025-01-06",
      amount: "10000",
      currency: "EUR",
    },
    {
      accountId: pea.id,
      instrumentId: msciWorld.id,
      type: "achat",
      tradeDate: "2025-01-07",
      quantity: "15",
      unitPrice: "520.40",
      fees: "1.99",
      currency: "EUR",
    },
    {
      accountId: pea.id,
      instrumentId: lvmh.id,
      type: "achat",
      tradeDate: "2025-02-10",
      quantity: "3",
      unitPrice: "690.00",
      fees: "1.99",
      currency: "EUR",
    },
    {
      accountId: cto.id,
      type: "versement",
      tradeDate: "2025-03-03",
      amount: "5000",
      currency: "EUR",
    },
    {
      accountId: cto.id,
      instrumentId: microsoft.id,
      type: "achat",
      tradeDate: "2025-03-04",
      quantity: "10",
      unitPrice: "390.00",
      fees: "2.00",
      currency: "USD",
      fxRateToEur: "1.0540",
    },
    {
      accountId: cto.id,
      instrumentId: microsoft.id,
      type: "dividende",
      tradeDate: "2025-06-12",
      amount: "8.30",
      taxes: "1.25",
      currency: "USD",
      fxRateToEur: "1.1480",
    },
    {
      accountId: av.id,
      type: "versement",
      tradeDate: "2025-01-15",
      amount: "5000",
      currency: "EUR",
    },
    {
      accountId: av.id,
      instrumentId: fondsEuros.id,
      type: "achat",
      tradeDate: "2025-01-15",
      quantity: "5000",
      unitPrice: "1",
      currency: "EUR",
    },
    {
      accountId: av.id,
      instrumentId: fondsEuros.id,
      type: "interets",
      tradeDate: "2025-12-31",
      amount: "125.00",
      quantity: "125.00",
      currency: "EUR",
    },
  ]);

  await db
    .insert(schema.prices)
    .values([
      { instrumentId: msciWorld.id, date: "2026-10-06", close: "585.12", source: "demo" },
      { instrumentId: lvmh.id, date: "2026-10-06", close: "642.30", source: "demo" },
      { instrumentId: microsoft.id, date: "2026-10-06", close: "455.80", source: "demo" },
    ])
    .onConflictDoNothing();
  await db
    .insert(schema.fxRates)
    .values([{ date: "2026-10-06", currency: "USD", rate: "1.1620", source: "demo" }])
    .onConflictDoNothing();

  const [thesis] = await db
    .insert(schema.theses)
    .values({
      userId: user.id,
      instrumentId: lvmh.id,
      thesisText:
        "Marques de luxe à fort pouvoir de prix ; la demande longue durée reste portée par la clientèle aisée mondiale.",
      invalidationConditions:
        "Marge opérationnelle durablement sous 20 % ou perte de parts de marché de la Mode & Maroquinerie sur 2 ans.",
      horizonMonths: 60,
      conviction: 4,
      reviewIntervalMonths: 6,
      reviewOnEarnings: true,
      nextReviewOn: "2026-08-10",
    })
    .returning();

  await db.insert(schema.thesisMetrics).values({
    thesisId: thesis.id,
    name: "Marge opérationnelle courante",
    operator: "gte",
    threshold: "20",
    unit: "%",
    currentValue: "23.1",
    currentValueAsOf: "2025-12-31",
    currentValueSource: "Document d'enregistrement universel 2025 (démo)",
  });

  await pool.end();
  console.log(`Données de démonstration créées pour ${user.email}.`);
}

/** Les instruments partagés survivent à la suppression de l'utilisateur démo : on les réutilise. */
async function upsertSharedInstrument(db: Db, values: typeof schema.instruments.$inferInsert) {
  const [existing] = await db
    .select()
    .from(schema.instruments)
    .where(and(eq(schema.instruments.isin, values.isin!), isNull(schema.instruments.ownerUserId)));
  if (existing) return existing;
  const [created] = await db.insert(schema.instruments).values(values).returning();
  return created;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
