/**
 * Jeu de démonstration : ~2 ans d'historique sur un PEA, un CTO et une assurance-vie.
 * Les cours sont SIMULÉS (marche aléatoire déterministe, source « démo ») : ils ressemblent à
 * des cours réels mais n'en sont pas. Les transactions sont passées aux cours simulés du jour.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from ".";
import * as schema from "./schema";
import { addMonths, toDate, toIso } from "../lib/dates";

type NewInstrument = typeof schema.instruments.$inferInsert;
type NewTx = typeof schema.transactions.$inferInsert;

const START = "2024-01-02";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function businessDays(from: string, to: string) {
  const out: string[] = [];
  for (let d = toDate(from); toIso(d) <= to; d = new Date(d.getTime() + 86_400_000)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(toIso(d));
  }
  return out;
}

/** Marche aléatoire géométrique : rendement annuel moyen `drift`, volatilité annuelle `vol`. */
function simulate(
  days: string[],
  start: number,
  drift: number,
  vol: number,
  seed: number,
  decimals = 2,
) {
  const rand = mulberry32(seed);
  const dt = 1 / 252;
  let price = start;
  const out = new Map<string, number>();
  for (const day of days) {
    out.set(day, Number(price.toFixed(decimals)));
    // Box-Muller
    const z = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    price *= Math.exp((drift - (vol * vol) / 2) * dt + vol * Math.sqrt(dt) * z);
  }
  return out;
}

const SHARED: (NewInstrument & { sim: [number, number, number, number] })[] = [
  {
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
    sim: [430, 0.1, 0.14, 9],
  },
  {
    isin: "FR0013412020",
    ticker: "PAEEM",
    exchangeMic: "XPAR",
    name: "Amundi PEA Emerging Markets ESG UCITS ETF",
    type: "etf",
    assetClass: "actions",
    currency: "EUR",
    country: "FR",
    region: "emergents",
    providerRefs: { eodhd: "PAEEM.PA" },
    sim: [22.5, 0.06, 0.17, 20],
  },
  {
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
    sim: [740, -0.06, 0.26, 1],
  },
  {
    isin: "FR0000120073",
    ticker: "AI",
    exchangeMic: "XPAR",
    name: "Air Liquide",
    type: "action",
    assetClass: "actions",
    currency: "EUR",
    country: "FR",
    region: "france",
    sector: "Matériaux",
    providerRefs: { eodhd: "AI.PA" },
    sim: [158, 0.08, 0.16, 8],
  },
  {
    isin: "FR0000121485",
    ticker: "KER",
    exchangeMic: "XPAR",
    name: "Kering",
    type: "action",
    assetClass: "actions",
    currency: "EUR",
    country: "FR",
    region: "france",
    sector: "Consommation discrétionnaire",
    providerRefs: { eodhd: "KER.PA" },
    sim: [400, -0.25, 0.3, 4],
  },
  {
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
    sim: [372, 0.14, 0.22, 20],
  },
];

async function upsertShared(db: Db, values: NewInstrument) {
  const [existing] = await db
    .select()
    .from(schema.instruments)
    .where(and(eq(schema.instruments.isin, values.isin!), isNull(schema.instruments.ownerUserId)));
  if (existing) return existing;
  const [created] = await db.insert(schema.instruments).values(values).returning();
  return created;
}

export async function loadDemoData(db: Db, userId: string, today: string) {
  const days = businessDays(START, today);
  const lastDay = days[days.length - 1];

  // Instruments partagés et cours simulés (insérés une seule fois).
  const inst: Record<string, typeof schema.instruments.$inferSelect> = {};
  const px: Record<string, Map<string, number>> = {};
  for (const { sim, ...values } of SHARED) {
    const row = await upsertShared(db, values);
    inst[values.ticker!] = row;
    px[values.ticker!] = simulate(days, ...sim);
    const rows = [...px[values.ticker!]].map(([date, close]) => ({
      instrumentId: row.id,
      date,
      close: String(close),
      source: "démo",
    }));
    // Les cours simulés sont régénérés à chaque chargement (déterministes) ; les vrais cours sont conservés.
    await db
      .delete(schema.prices)
      .where(and(eq(schema.prices.instrumentId, row.id), eq(schema.prices.source, "démo")));
    for (let i = 0; i < rows.length; i += 1000) {
      await db
        .insert(schema.prices)
        .values(rows.slice(i, i + 1000))
        .onConflictDoNothing();
    }
  }
  const usd = simulate(days, 1.095, 0.02, 0.07, 1, 4);
  await db
    .delete(schema.fxRates)
    .where(and(eq(schema.fxRates.currency, "USD"), eq(schema.fxRates.source, "démo")));
  await db
    .insert(schema.fxRates)
    .values(
      [...usd].map(([date, rate]) => ({
        date,
        currency: "USD",
        rate: String(rate),
        source: "démo",
      })),
    )
    .onConflictDoNothing();

  /** Cours simulé du jour ouvré le plus proche (à partir de la date donnée). */
  const on = (ticker: string, date: string) => {
    const day = days.find((d) => d >= date) ?? lastDay;
    return { day, price: px[ticker].get(day)! };
  };

  const [fondsEuros] = await db
    .insert(schema.instruments)
    .values({
      name: "Fonds euros — contrat Démo Vie",
      type: "fonds_euros",
      assetClass: "fonds_euros",
      currency: "EUR",
      valuationMode: "nominal",
      region: "europe",
      ownerUserId: userId,
    })
    .returning();

  await db
    .update(schema.users)
    .set({ benchmarkInstrumentId: inst.CW8.id })
    .where(eq(schema.users.id, userId));

  const [pea, cto, av] = await db
    .insert(schema.investmentAccounts)
    .values([
      {
        userId,
        type: "pea" as const,
        name: "PEA",
        institution: "Courtier en ligne",
        openedOn: "2019-03-12",
      },
      { userId, type: "cto" as const, name: "Compte-titres", institution: "Courtier en ligne" },
      { userId, type: "assurance_vie" as const, name: "Assurance-vie", institution: "Démo Vie" },
    ])
    .returning();

  const txs: NewTx[] = [];
  const buy = (accountId: string, ticker: string, date: string, quantity: number, fees = 1.99) => {
    const { day, price } = on(ticker, date);
    const ttf =
      inst[ticker].country === "FR" && inst[ticker].type === "action"
        ? price * quantity * 0.004
        : 0;
    txs.push({
      accountId,
      instrumentId: inst[ticker].id,
      type: "achat",
      tradeDate: day,
      quantity: String(quantity),
      unitPrice: String(price),
      fees: String(fees),
      taxes: ttf.toFixed(2),
      currency: inst[ticker].currency,
      fxRateToEur: inst[ticker].currency === "USD" ? String(usd.get(day)) : null,
    });
  };
  const sell = (accountId: string, ticker: string, date: string, quantity: number, fees = 1.99) => {
    const { day, price } = on(ticker, date);
    txs.push({
      accountId,
      instrumentId: inst[ticker].id,
      type: "vente",
      tradeDate: day,
      quantity: String(quantity),
      unitPrice: String(price),
      fees: String(fees),
      currency: inst[ticker].currency,
    });
  };
  const cash = (accountId: string, type: "versement" | "retrait", date: string, amount: number) =>
    txs.push({ accountId, type, tradeDate: date, amount: String(amount), currency: "EUR" });

  // PEA : apport initial puis investissement programmé mensuel sur le MSCI World.
  cash(pea.id, "versement", "2024-01-02", 15000);
  buy(pea.id, "CW8", "2024-01-03", 12);
  buy(pea.id, "MC", "2024-01-15", 4);
  buy(pea.id, "KER", "2024-02-12", 6);
  buy(pea.id, "AI", "2024-03-04", 10);
  buy(pea.id, "PAEEM", "2024-04-02", 60);
  for (let m = 1; addMonths("2024-01-05", m) <= lastDay; m++) {
    const date = addMonths("2024-01-05", m);
    cash(pea.id, "versement", date, 500);
    buy(pea.id, "CW8", addMonths("2024-01-06", m), 1, 0.99);
  }
  sell(pea.id, "KER", "2025-04-14", 6);
  sell(pea.id, "MC", "2025-09-10", 1);
  for (const year of ["2024", "2025", "2026"]) {
    const date = `${year}-05-0${year === "2025" ? 6 : 7}`;
    if (date > lastDay) continue;
    txs.push({
      accountId: pea.id,
      instrumentId: inst.AI.id,
      type: "dividende",
      tradeDate: date,
      amount: "33.00",
      currency: "EUR",
    });
    txs.push({
      accountId: pea.id,
      instrumentId: inst.MC.id,
      type: "dividende",
      tradeDate: `${year}-04-25`,
      amount: year === "2024" ? "52.00" : "39.00",
      currency: "EUR",
    });
  }

  // CTO : titres américains, dividendes avec retenue à la source.
  cash(cto.id, "versement", "2024-02-01", 6000);
  buy(cto.id, "MSFT", "2024-02-05", 12, 2.5);
  buy(cto.id, "MSFT", "2025-04-08", 3, 2.5);
  for (let q = 0; addMonths("2024-03-14", q * 3) <= lastDay; q++) {
    const date = addMonths("2024-03-14", q * 3);
    const shares = date >= "2025-04-08" ? 15 : 12;
    const gross = shares * (date >= "2024-09-01" ? 0.83 : 0.75);
    txs.push({
      accountId: cto.id,
      instrumentId: inst.MSFT.id,
      type: "dividende",
      tradeDate: date,
      amount: gross.toFixed(2),
      taxes: (gross * 0.15).toFixed(2),
      currency: "USD",
    });
  }
  txs.push({
    accountId: cto.id,
    type: "frais",
    tradeDate: "2025-01-02",
    amount: "12.00",
    currency: "EUR",
    notes: "Droits de garde 2024",
  });

  // Assurance-vie : fonds euros + unités de compte.
  cash(av.id, "versement", "2024-01-10", 8000);
  txs.push({
    accountId: av.id,
    instrumentId: fondsEuros.id,
    type: "achat",
    tradeDate: "2024-01-10",
    quantity: "5000",
    unitPrice: "1",
    currency: "EUR",
  });
  buy(av.id, "CW8", "2024-01-10", 6, 0);
  txs.push({
    accountId: av.id,
    instrumentId: fondsEuros.id,
    type: "interets",
    tradeDate: "2024-12-31",
    amount: "130.00",
    quantity: "130.00",
    taxes: "0",
    currency: "EUR",
  });
  if ("2025-12-31" <= lastDay) {
    txs.push({
      accountId: av.id,
      instrumentId: fondsEuros.id,
      type: "interets",
      tradeDate: "2025-12-31",
      amount: "138.40",
      quantity: "138.40",
      currency: "EUR",
    });
  }
  txs.push({
    accountId: av.id,
    type: "frais",
    tradeDate: "2025-12-31",
    amount: "18.60",
    currency: "EUR",
    notes: "Frais de gestion UC",
  });

  await db.insert(schema.transactions).values(txs.filter((t) => t.tradeDate <= lastDay));

  // Journal de thèse.
  const [lvmh, airLiquide, msft, kering] = await db
    .insert(schema.theses)
    .values([
      {
        userId,
        instrumentId: inst.MC.id,
        thesisText:
          "Portefeuille de marques de luxe au pouvoir de prix rare. La demande de la clientèle très aisée est peu cyclique sur longue période ; le ralentissement chinois est conjoncturel.",
        invalidationConditions:
          "Marge opérationnelle courante durablement sous 20 %, ou recul organique de la Mode & Maroquinerie deux années de suite.",
        horizonMonths: 84,
        conviction: 3,
        reviewIntervalMonths: 6,
        reviewOnEarnings: true,
        nextReviewOn: "2027-01-28",
        createdAt: new Date("2024-01-15T10:00:00Z"),
      },
      {
        userId,
        instrumentId: inst.AI.id,
        thesisText:
          "Activité d'infrastructure (contrats de 15 ans indexés) : croissance régulière, marges en progression grâce au plan d'efficacité, et exposition à l'hydrogène en option gratuite.",
        invalidationConditions:
          "Marge opérationnelle en baisse deux ans de suite ou endettement net / EBITDA > 2,5.",
        horizonMonths: 120,
        conviction: 4,
        reviewIntervalMonths: 12,
        reviewOnEarnings: false,
        nextReviewOn: "2026-09-04",
        createdAt: new Date("2024-03-04T10:00:00Z"),
      },
      {
        userId,
        instrumentId: inst.MSFT.id,
        thesisText:
          "Position dominante dans le cloud d'entreprise (Azure) et la bureautique, avec un modèle par abonnement très rentable.",
        invalidationConditions: "Croissance d'Azure sous 25 % sur deux trimestres consécutifs.",
        horizonMonths: 60,
        conviction: 4,
        reviewIntervalMonths: 3,
        reviewOnEarnings: true,
        nextReviewOn: "2026-10-30",
        createdAt: new Date("2024-02-05T10:00:00Z"),
      },
      {
        userId,
        instrumentId: inst.KER.id,
        status: "cloturee" as const,
        thesisText:
          "Redressement de Gucci sous la nouvelle direction artistique ; valorisation déprimée.",
        invalidationConditions: "Chiffre d'affaires de Gucci encore en baisse à fin 2024.",
        horizonMonths: 36,
        conviction: 2,
        reviewIntervalMonths: 6,
        createdAt: new Date("2024-02-12T10:00:00Z"),
      },
    ])
    .returning();

  await db.insert(schema.thesisMetrics).values([
    {
      thesisId: lvmh.id,
      name: "Marge opérationnelle courante",
      operator: "gte",
      threshold: "20",
      unit: "%",
      currentValue: "22.6",
      currentValueAsOf: "2025-12-31",
      currentValueSource: "Document d'enregistrement universel 2025 (démo)",
    },
    {
      thesisId: lvmh.id,
      name: "Croissance organique Mode & Maroquinerie",
      operator: "gt",
      threshold: "0",
      unit: "%",
      currentValue: "-3.0",
      currentValueAsOf: "2026-06-30",
      currentValueSource: "Résultats semestriels 2026 (démo)",
      position: 1,
    },
    {
      thesisId: airLiquide.id,
      name: "Marge opérationnelle",
      operator: "gte",
      threshold: "19",
      unit: "%",
      currentValue: "20.4",
      currentValueAsOf: "2025-12-31",
      currentValueSource: "Rapport annuel 2025 (démo)",
    },
    {
      thesisId: airLiquide.id,
      name: "Dette nette / EBITDA",
      operator: "lte",
      threshold: "2.5",
      unit: "x",
      currentValue: "1.6",
      currentValueAsOf: "2025-12-31",
      currentValueSource: "Rapport annuel 2025 (démo)",
      position: 1,
    },
    {
      thesisId: msft.id,
      name: "Croissance d'Azure",
      operator: "gte",
      threshold: "25",
      unit: "%",
      currentValue: "33",
      currentValueAsOf: "2026-06-30",
      currentValueSource: "Résultats T4 2026 (démo)",
    },
  ]);

  await db.insert(schema.thesisReviews).values([
    {
      thesisId: lvmh.id,
      reviewedOn: "2025-01-29",
      notes:
        "Résultats annuels : marge en recul mais au-dessus du seuil. La thèse tient ; je surveille la Chine.",
      convictionAfter: 4,
    },
    {
      thesisId: lvmh.id,
      reviewedOn: "2025-07-25",
      notes:
        "Recul organique de la Mode & Maroquinerie au S1. Premier signal de la condition d'invalidation. Conviction abaissée.",
      convictionAfter: 3,
    },
    {
      thesisId: msft.id,
      reviewedOn: "2026-07-31",
      notes:
        "Azure toujours au-dessus de 30 %. Investissements IA très lourds : à suivre sur la marge.",
      convictionAfter: 4,
    },
    {
      thesisId: kering.id,
      reviewedOn: "2024-08-01",
      notes: "Gucci −20 % au S1. La condition d'invalidation se rapproche.",
      convictionAfter: 2,
    },
  ]);

  await db.insert(schema.thesisClosures).values({
    thesisId: kering.id,
    closedOn: on("KER", "2025-04-14").day,
    saleReason:
      "Condition d'invalidation remplie : le chiffre d'affaires de Gucci a encore reculé en 2024.",
    thesisValidated: "non",
    assessment:
      "Je misais sur un redressement rapide sans indicateur avancé pour le confirmer. J'ai respecté la règle de sortie fixée à l'achat ; à l'avenir, demander un premier signal opérationnel avant d'acheter un retournement.",
  });
}
