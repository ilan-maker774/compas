/**
 * Couche d'abstraction des données de marché : le reste de l'application ne connaît que
 * ces interfaces, ce qui permet de changer de fournisseur (EODHD, FMP…) sans rien toucher d'autre.
 * Uniquement des cours de clôture quotidiens : Compas n'affiche pas d'intraday.
 */

export type DailyClose = { date: string; close: string };

export interface PriceProvider {
  /** Identifiant, utilisé comme clé dans instruments.provider_refs et comme source des cours. */
  readonly id: string;
  getDailyCloses(ref: string, from: string, to: string): Promise<DailyClose[]>;
  /** Prochaine date de publication de résultats, si le fournisseur la connaît. */
  getNextEarningsDate?(ref: string, from: string): Promise<string | null>;
}

export type FxObservation = { date: string; currency: string; rate: string };

export interface FxProvider {
  readonly id: string;
  /** Taux 1 EUR = x devise. */
  getRates(currencies: string[], from: string, to: string): Promise<FxObservation[]>;
}
