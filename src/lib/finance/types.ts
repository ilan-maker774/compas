/**
 * Types d'entrée du moteur de calcul. Volontairement indépendants de la base de données :
 * le moteur est une suite de fonctions pures, testables avec des données écrites à la main.
 * Les montants sont des chaînes décimales (comme les renvoie PostgreSQL).
 */

export type TransactionType =
  | "achat"
  | "vente"
  | "dividende"
  | "interets"
  | "frais"
  | "taxe"
  | "versement"
  | "retrait";

export type TxInput = {
  id: string;
  accountId: string;
  instrumentId: string | null;
  type: TransactionType;
  /** AAAA-MM-JJ */
  tradeDate: string;
  quantity: string | null;
  unitPrice: string | null;
  amount: string | null;
  fees: string;
  taxes: string;
  currency: string;
  /** 1 EUR = x devise, taux appliqué par l'intermédiaire s'il est connu. */
  fxRateToEur: string | null;
};

export type InstrumentInput = {
  id: string;
  name: string;
  currency: string;
  valuationMode: "market" | "nominal";
  assetClass: string;
  region: string | null;
};

export type AccountInput = {
  id: string;
  name: string;
  type: string;
};

export type PricePoint = { date: string; close: string; source: string };
export type FxPoint = { date: string; rate: string; source: string };

export type PortfolioData = {
  accounts: AccountInput[];
  instruments: InstrumentInput[];
  transactions: TxInput[];
  /** Cours par instrument, triés par date croissante. */
  prices: Map<string, PricePoint[]>;
  /** Taux BCE par devise (1 EUR = x devise), triés par date croissante. */
  fxRates: Map<string, FxPoint[]>;
};
