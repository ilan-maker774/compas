import { EcbFxProvider } from "./ecb";
import { EodhdProvider } from "./eodhd";
import type { FxProvider, PriceProvider } from "./types";

export type { FxProvider, PriceProvider } from "./types";

/** Fournisseur de cours configuré (MARKET_DATA_PROVIDER), ou null : cours saisis à la main. */
export function getPriceProvider(env = process.env): PriceProvider | null {
  switch (env.MARKET_DATA_PROVIDER) {
    case "eodhd":
      if (!env.EODHD_API_KEY) throw new Error("EODHD_API_KEY manquant");
      return new EodhdProvider(env.EODHD_API_KEY);
    case undefined:
    case "":
      return null;
    default:
      throw new Error(`Fournisseur de données inconnu : ${env.MARKET_DATA_PROVIDER}`);
  }
}

export function getFxProvider(): FxProvider {
  return new EcbFxProvider();
}
