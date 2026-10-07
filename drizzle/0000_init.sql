CREATE TYPE "public"."account_type" AS ENUM('pea', 'pea_pme', 'cto', 'assurance_vie', 'per', 'autre');--> statement-breakpoint
CREATE TYPE "public"."asset_class" AS ENUM('actions', 'obligations', 'monetaire', 'fonds_euros', 'immobilier', 'matieres_premieres', 'mixte', 'autre');--> statement-breakpoint
CREATE TYPE "public"."comparison_operator" AS ENUM('gt', 'gte', 'lt', 'lte');--> statement-breakpoint
CREATE TYPE "public"."instrument_type" AS ENUM('action', 'etf', 'fonds', 'obligation', 'fonds_euros', 'indice', 'autre');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('monde', 'france', 'europe', 'amerique_du_nord', 'japon', 'asie_pacifique', 'emergents', 'autre');--> statement-breakpoint
CREATE TYPE "public"."thesis_outcome" AS ENUM('oui', 'non', 'partiellement');--> statement-breakpoint
CREATE TYPE "public"."thesis_status" AS ENUM('active', 'cloturee');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('achat', 'vente', 'dividende', 'interets', 'frais', 'taxe', 'versement', 'retrait');--> statement-breakpoint
CREATE TYPE "public"."valuation_mode" AS ENUM('market', 'nominal');--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"date" date NOT NULL,
	"currency" char(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"source" text DEFAULT 'ecb' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_date_currency_pk" PRIMARY KEY("date","currency"),
	CONSTRAINT "fx_rates_rate_positive" CHECK ("fx_rates"."rate" > 0),
	CONSTRAINT "fx_rates_not_eur" CHECK ("fx_rates"."currency" <> 'EUR')
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"column_mapping" jsonb NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isin" char(12),
	"ticker" text,
	"exchange_mic" char(4),
	"name" text NOT NULL,
	"type" "instrument_type" NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"currency" char(3) NOT NULL,
	"country" char(2),
	"region" "region",
	"sector" text,
	"valuation_mode" "valuation_mode" DEFAULT 'market' NOT NULL,
	"provider_refs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_isin_format" CHECK ("instruments"."isin" IS NULL OR "instruments"."isin" ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
	CONSTRAINT "instruments_fonds_euros_nominal" CHECK ("instruments"."type" <> 'fonds_euros' OR "instruments"."valuation_mode" = 'nominal')
);
--> statement-breakpoint
CREATE TABLE "investment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "account_type" NOT NULL,
	"name" text NOT NULL,
	"institution" text,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"opened_on" date,
	"closed_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"instrument_id" uuid NOT NULL,
	"date" date NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_instrument_id_date_pk" PRIMARY KEY("instrument_id","date"),
	CONSTRAINT "prices_close_positive" CHECK ("prices"."close" > 0)
);
--> statement-breakpoint
CREATE TABLE "theses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"status" "thesis_status" DEFAULT 'active' NOT NULL,
	"thesis_text" text NOT NULL,
	"invalidation_conditions" text,
	"horizon_months" smallint,
	"conviction" smallint NOT NULL,
	"review_interval_months" smallint,
	"review_on_earnings" boolean DEFAULT false NOT NULL,
	"next_review_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theses_conviction_range" CHECK ("theses"."conviction" BETWEEN 1 AND 5),
	CONSTRAINT "theses_horizon_positive" CHECK ("theses"."horizon_months" IS NULL OR "theses"."horizon_months" > 0),
	CONSTRAINT "theses_review_interval_positive" CHECK ("theses"."review_interval_months" IS NULL OR "theses"."review_interval_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "thesis_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"closed_on" date NOT NULL,
	"sale_reason" text NOT NULL,
	"thesis_validated" "thesis_outcome" NOT NULL,
	"assessment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thesis_closures_thesis_id_unique" UNIQUE("thesis_id")
);
--> statement-breakpoint
CREATE TABLE "thesis_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"name" text NOT NULL,
	"operator" "comparison_operator" NOT NULL,
	"threshold" numeric(20, 8) NOT NULL,
	"unit" text,
	"current_value" numeric(20, 8),
	"current_value_as_of" date,
	"current_value_source" text,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thesis_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"reviewed_on" date NOT NULL,
	"notes" text NOT NULL,
	"conviction_after" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thesis_reviews_conviction_range" CHECK ("thesis_reviews"."conviction_after" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid,
	"type" "transaction_type" NOT NULL,
	"trade_date" date NOT NULL,
	"quantity" numeric(28, 10),
	"unit_price" numeric(20, 8),
	"amount" numeric(20, 8),
	"fees" numeric(20, 8) DEFAULT '0' NOT NULL,
	"taxes" numeric(20, 8) DEFAULT '0' NOT NULL,
	"currency" char(3) NOT NULL,
	"fx_rate_to_eur" numeric(20, 10),
	"notes" text,
	"import_batch_id" uuid,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_fees_non_negative" CHECK ("transactions"."fees" >= 0),
	CONSTRAINT "transactions_taxes_non_negative" CHECK ("transactions"."taxes" >= 0),
	CONSTRAINT "transactions_fx_positive" CHECK ("transactions"."fx_rate_to_eur" IS NULL OR "transactions"."fx_rate_to_eur" > 0),
	CONSTRAINT "transactions_trade_fields" CHECK ("transactions"."type" NOT IN ('achat', 'vente') OR (
        "transactions"."instrument_id" IS NOT NULL AND "transactions"."quantity" > 0 AND "transactions"."unit_price" >= 0)),
	CONSTRAINT "transactions_income_fields" CHECK ("transactions"."type" NOT IN ('dividende', 'interets') OR (
        "transactions"."instrument_id" IS NOT NULL AND "transactions"."amount" >= 0)),
	CONSTRAINT "transactions_cash_fields" CHECK ("transactions"."type" NOT IN ('versement', 'retrait') OR (
        "transactions"."instrument_id" IS NULL AND "transactions"."amount" > 0)),
	CONSTRAINT "transactions_fee_tax_fields" CHECK ("transactions"."type" NOT IN ('frais', 'taxe') OR "transactions"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"reference_currency" char(3) DEFAULT 'EUR' NOT NULL,
	"benchmark_instrument_id" uuid,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theses" ADD CONSTRAINT "theses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theses" ADD CONSTRAINT "theses_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis_closures" ADD CONSTRAINT "thesis_closures_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis_metrics" ADD CONSTRAINT "thesis_metrics_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis_reviews" ADD CONSTRAINT "thesis_reviews_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_benchmark_instrument_id_instruments_id_fk" FOREIGN KEY ("benchmark_instrument_id") REFERENCES "public"."instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batches_account_idx" ON "import_batches" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_isin_shared_uq" ON "instruments" USING btree ("isin") WHERE "instruments"."owner_user_id" IS NULL AND "instruments"."isin" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "instruments_ticker_idx" ON "instruments" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "investment_accounts_user_idx" ON "investment_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "theses_user_status_idx" ON "theses" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "theses_next_review_idx" ON "theses" USING btree ("next_review_on");--> statement-breakpoint
CREATE INDEX "thesis_metrics_thesis_idx" ON "thesis_metrics" USING btree ("thesis_id");--> statement-breakpoint
CREATE INDEX "thesis_reviews_thesis_idx" ON "thesis_reviews" USING btree ("thesis_id","reviewed_on");--> statement-breakpoint
CREATE INDEX "transactions_account_date_idx" ON "transactions" USING btree ("account_id","trade_date");--> statement-breakpoint
CREATE INDEX "transactions_instrument_idx" ON "transactions" USING btree ("instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_ref_uq" ON "transactions" USING btree ("account_id","external_ref") WHERE "transactions"."external_ref" IS NOT NULL;