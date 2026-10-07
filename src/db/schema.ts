/**
 * Modèle de données de Compas (V1).
 *
 * Conventions :
 * - Montants et quantités en `numeric` (renvoyés sous forme de chaîne par le driver)
 *   pour ne jamais perdre de précision ; les calculs utilisent decimal.js.
 * - Devises en code ISO 4217 (EUR, USD…), pays en ISO 3166-1 alpha-2.
 * - Tout ce qui appartient à un utilisateur est supprimé en cascade avec lui (RGPD).
 * - Voir docs/02-modele-de-donnees.md pour les choix métier.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Montant monétaire : 20 chiffres dont 8 décimales (couvre les cours à 4+ décimales). */
const money = (name: string) => numeric(name, { precision: 20, scale: 8 });
/** Quantité : parts fractionnées en assurance-vie (souvent 4 à 6 décimales). */
const quantity = (name: string) => numeric(name, { precision: 28, scale: 10 });

// ---------------------------------------------------------------------------
// Utilisateur
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  /** Devise dans laquelle tout le patrimoine est consolidé. EUR en V1. */
  referenceCurrency: char("reference_currency", { length: 3 }).notNull().default("EUR"),
  /** Benchmark choisi pour la comparaison de performance. */
  benchmarkInstrumentId: uuid("benchmark_instrument_id").references(
    (): AnyPgColumn => instruments.id,
    { onDelete: "set null" },
  ),
  /** Préférences d'affichage (thème, horizon par défaut…). */
  preferences: jsonb("preferences").$type<UserPreferences>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type UserPreferences = {
  theme?: "light" | "dark" | "system";
  /** Horizon par défaut des graphiques ; jamais inférieur à 1 mois (cf. vision). */
  defaultChartRange?: "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "MAX";
};

// ---------------------------------------------------------------------------
// Comptes d'investissement
// (nommés « investment_accounts » pour ne pas entrer en conflit avec la table
//  « accounts » d'Auth.js qui stocke les comptes OAuth)
// ---------------------------------------------------------------------------

export const accountTypeEnum = pgEnum("account_type", [
  "pea",
  "pea_pme",
  "cto",
  "assurance_vie",
  "per",
  "autre",
]);

export const investmentAccounts = pgTable(
  "investment_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: accountTypeEnum("type").notNull(),
    name: text("name").notNull(),
    institution: text("institution"),
    /** Devise de tenue du compte (presque toujours EUR pour un compte français). */
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    openedOn: date("opened_on", { mode: "string" }),
    closedOn: date("closed_on", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("investment_accounts_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

export const instrumentTypeEnum = pgEnum("instrument_type", [
  "action",
  "etf",
  "fonds", // OPCVM / SICAV / FCP non coté en bourse
  "obligation",
  "fonds_euros", // support en euros d'assurance-vie / PER
  "indice", // benchmark uniquement, non détenable
  "autre",
]);

/** Classe d'actifs : distincte du type (un ETF peut être actions ou obligations). */
export const assetClassEnum = pgEnum("asset_class", [
  "actions",
  "obligations",
  "monetaire",
  "fonds_euros",
  "immobilier",
  "matieres_premieres",
  "mixte",
  "autre",
]);

/** Zone géographique d'exposition déclarée (V1). La V2 calculera l'exposition réelle par transparisation. */
export const regionEnum = pgEnum("region", [
  "monde",
  "france",
  "europe",
  "amerique_du_nord",
  "japon",
  "asie_pacifique",
  "emergents",
  "autre",
]);

/**
 * Mode de valorisation :
 * - `market` : quantité × cours de clôture (actions, ETF, fonds cotés ou VL).
 * - `nominal` : la quantité EST le montant en devise (cours fixe de 1). Utilisé pour le
 *   fonds euros : chaque versement ajoute des « parts » à 1 €, les intérêts crédités aussi.
 */
export const valuationModeEnum = pgEnum("valuation_mode", ["market", "nominal"]);

export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    isin: char("isin", { length: 12 }),
    ticker: text("ticker"),
    /** Code MIC de la place de cotation (XPAR, XNAS…), pour lever l'ambiguïté des tickers. */
    exchangeMic: char("exchange_mic", { length: 4 }),
    name: text("name").notNull(),
    type: instrumentTypeEnum("type").notNull(),
    assetClass: assetClassEnum("asset_class").notNull(),
    /** Devise de cotation (celle dans laquelle sont exprimés les cours). */
    currency: char("currency", { length: 3 }).notNull(),
    /** Pays du siège (action) ou de domiciliation (fonds). */
    country: char("country", { length: 2 }),
    region: regionEnum("region"),
    sector: text("sector"),
    valuationMode: valuationModeEnum("valuation_mode").notNull().default("market"),
    /**
     * Identifiants chez chaque fournisseur de données ({ "eodhd": "CW8.PA" }).
     * Permet de changer de fournisseur sans toucher au reste du modèle.
     */
    providerRefs: jsonb("provider_refs").$type<Record<string, string>>().notNull().default({}),
    /**
     * Instrument privé créé à la main par un utilisateur (fonds euros d'un contrat précis,
     * titre non coté…). NULL = instrument de référence partagé.
     */
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Un ISIN n'est unique que parmi les instruments partagés.
    uniqueIndex("instruments_isin_shared_uq")
      .on(t.isin)
      .where(sql`${t.ownerUserId} IS NULL AND ${t.isin} IS NOT NULL`),
    index("instruments_ticker_idx").on(t.ticker),
    check(
      "instruments_isin_format",
      sql`${t.isin} IS NULL OR ${t.isin} ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'`,
    ),
    check(
      "instruments_fonds_euros_nominal",
      sql`${t.type} <> 'fonds_euros' OR ${t.valuationMode} = 'nominal'`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Cours et taux de change
// ---------------------------------------------------------------------------

/** Cours de clôture quotidien, dans la devise de l'instrument. Pas de données intraday. */
export const prices = pgTable(
  "prices",
  {
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    close: money("close").notNull(),
    /** Provenance du chiffre (« eodhd », « fmp », « manual »…) : chaque chiffre est sourcé. */
    source: text("source").notNull(),
    fetchedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.instrumentId, t.date] }),
    check("prices_close_positive", sql`${t.close} > 0`),
  ],
);

/**
 * Taux de change de référence : 1 EUR = `rate` unités de `currency`.
 * Source par défaut : taux de référence quotidiens de la BCE (gratuits, officiels).
 * Conversion : montant_eur = montant_devise / rate.
 */
export const fxRates = pgTable(
  "fx_rates",
  {
    date: date("date", { mode: "string" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    source: text("source").notNull().default("ecb"),
    fetchedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.date, t.currency] }),
    check("fx_rates_rate_positive", sql`${t.rate} > 0`),
    check("fx_rates_not_eur", sql`${t.currency} <> 'EUR'`),
  ],
);

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const transactionTypeEnum = pgEnum("transaction_type", [
  "achat",
  "vente",
  "dividende",
  "interets", // coupons d'obligation, intérêts crédités sur fonds euros
  "frais", // frais hors opération : droits de garde, frais de gestion AV…
  "taxe", // prélèvements sociaux, impôt hors opération
  "versement", // apport d'argent frais sur le compte
  "retrait", // sortie d'argent du compte
]);

/**
 * Une ligne = un mouvement sur un compte.
 *
 * Tous les montants (prix, montant, frais, taxes) sont exprimés dans `currency`.
 * `fxRateToEur` est le taux réellement appliqué (1 EUR = x devise) ; s'il est absent,
 * les calculs utilisent le taux BCE du jour de l'opération.
 *
 * Champs requis selon le type :
 * - achat / vente : instrument, quantity, unitPrice (montant brut = quantity × unitPrice).
 * - dividende / interets : instrument, amount (brut), taxes éventuelles (retenue à la source).
 *   Pour un fonds euros, les intérêts crédités renseignent aussi quantity (= montant net).
 * - frais / taxe : amount ; instrument facultatif.
 * - versement / retrait : amount ; pas d'instrument.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => investmentAccounts.id, { onDelete: "cascade" }),
    // « restrict » : un instrument référencé ne peut pas disparaître. La suppression d'un
    // utilisateur passe donc par deleteUserData(), qui supprime dans le bon ordre.
    instrumentId: uuid("instrument_id").references(() => instruments.id, {
      onDelete: "restrict",
    }),
    type: transactionTypeEnum("type").notNull(),
    tradeDate: date("trade_date", { mode: "string" }).notNull(),
    quantity: quantity("quantity"),
    unitPrice: money("unit_price"),
    amount: money("amount"),
    fees: money("fees").notNull().default("0"),
    taxes: money("taxes").notNull().default("0"),
    currency: char("currency", { length: 3 }).notNull(),
    fxRateToEur: numeric("fx_rate_to_eur", { precision: 20, scale: 10 }),
    notes: text("notes"),
    /** Lot d'import CSV d'origine (permet d'annuler un import complet). */
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    /** Empreinte de la ligne source pour éviter les doublons lors d'un ré-import. */
    externalRef: text("external_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("transactions_account_date_idx").on(t.accountId, t.tradeDate),
    index("transactions_instrument_idx").on(t.instrumentId),
    uniqueIndex("transactions_external_ref_uq")
      .on(t.accountId, t.externalRef)
      .where(sql`${t.externalRef} IS NOT NULL`),
    check("transactions_fees_non_negative", sql`${t.fees} >= 0`),
    check("transactions_taxes_non_negative", sql`${t.taxes} >= 0`),
    check("transactions_fx_positive", sql`${t.fxRateToEur} IS NULL OR ${t.fxRateToEur} > 0`),
    check(
      "transactions_trade_fields",
      sql`${t.type} NOT IN ('achat', 'vente') OR (
        ${t.instrumentId} IS NOT NULL AND ${t.quantity} > 0 AND ${t.unitPrice} >= 0)`,
    ),
    check(
      "transactions_income_fields",
      sql`${t.type} NOT IN ('dividende', 'interets') OR (
        ${t.instrumentId} IS NOT NULL AND ${t.amount} >= 0)`,
    ),
    check(
      "transactions_cash_fields",
      sql`${t.type} NOT IN ('versement', 'retrait') OR (
        ${t.instrumentId} IS NULL AND ${t.amount} > 0)`,
    ),
    check(
      "transactions_fee_tax_fields",
      sql`${t.type} NOT IN ('frais', 'taxe') OR ${t.amount} >= 0`,
    ),
  ],
);

/** Trace d'un import CSV, avec le mapping de colonnes utilisé (réutilisable). */
export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => investmentAccounts.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    columnMapping: jsonb("column_mapping").$type<Record<string, string>>().notNull(),
    rowCount: integer("row_count").notNull().default(0),
    importedAt: createdAt(),
  },
  (t) => [index("import_batches_account_idx").on(t.accountId)],
);

// ---------------------------------------------------------------------------
// Journal de thèse
// ---------------------------------------------------------------------------

export const thesisStatusEnum = pgEnum("thesis_status", ["active", "cloturee"]);
export const comparisonOperatorEnum = pgEnum("comparison_operator", ["gt", "gte", "lt", "lte"]);
export const thesisOutcomeEnum = pgEnum("thesis_outcome", ["oui", "non", "partiellement"]);

export const theses = pgTable(
  "theses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    status: thesisStatusEnum("status").notNull().default("active"),
    /** Pourquoi j'achète. */
    thesisText: text("thesis_text").notNull(),
    /** Ce qui prouverait que j'ai tort. */
    invalidationConditions: text("invalidation_conditions"),
    /** Horizon de détention prévu, en mois. */
    horizonMonths: smallint("horizon_months"),
    conviction: smallint("conviction").notNull(),
    /** Revue programmée tous les N mois (NULL = pas de revue périodique). */
    reviewIntervalMonths: smallint("review_interval_months"),
    /** Revue après chaque publication de résultats. */
    reviewOnEarnings: boolean("review_on_earnings").notNull().default(false),
    nextReviewOn: date("next_review_on", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("theses_user_status_idx").on(t.userId, t.status),
    index("theses_next_review_idx").on(t.nextReviewOn),
    check("theses_conviction_range", sql`${t.conviction} BETWEEN 1 AND 5`),
    check("theses_horizon_positive", sql`${t.horizonMonths} IS NULL OR ${t.horizonMonths} > 0`),
    check(
      "theses_review_interval_positive",
      sql`${t.reviewIntervalMonths} IS NULL OR ${t.reviewIntervalMonths} > 0`,
    ),
  ],
);

/** Indicateur clé d'une thèse (1 à 3 par thèse, limite appliquée côté application). */
export const thesisMetrics = pgTable(
  "thesis_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    thesisId: uuid("thesis_id")
      .notNull()
      .references(() => theses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    operator: comparisonOperatorEnum("operator").notNull(),
    threshold: money("threshold").notNull(),
    /** Unité d'affichage : « % », « € », « x »… */
    unit: text("unit"),
    currentValue: money("current_value"),
    currentValueAsOf: date("current_value_as_of", { mode: "string" }),
    /** Source de la valeur actuelle (« rapport annuel 2025 p. 42 », « saisie manuelle »…). */
    currentValueSource: text("current_value_source"),
    position: smallint("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("thesis_metrics_thesis_idx").on(t.thesisId)],
);

export const thesisReviews = pgTable(
  "thesis_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    thesisId: uuid("thesis_id")
      .notNull()
      .references(() => theses.id, { onDelete: "cascade" }),
    reviewedOn: date("reviewed_on", { mode: "string" }).notNull(),
    notes: text("notes").notNull(),
    convictionAfter: smallint("conviction_after").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("thesis_reviews_thesis_idx").on(t.thesisId, t.reviewedOn),
    check("thesis_reviews_conviction_range", sql`${t.convictionAfter} BETWEEN 1 AND 5`),
  ],
);

export const thesisClosures = pgTable("thesis_closures", {
  id: uuid("id").primaryKey().defaultRandom(),
  thesisId: uuid("thesis_id")
    .notNull()
    .unique()
    .references(() => theses.id, { onDelete: "cascade" }),
  closedOn: date("closed_on", { mode: "string" }).notNull(),
  saleReason: text("sale_reason").notNull(),
  /** La thèse s'est-elle réalisée, indépendamment du gain ou de la perte ? */
  thesisValidated: thesisOutcomeEnum("thesis_validated").notNull(),
  assessment: text("assessment").notNull(),
  createdAt: createdAt(),
});
