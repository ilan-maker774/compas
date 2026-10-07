import type { InstrumentInput, PortfolioData, TxInput } from "@/lib/finance/types";

let seq = 0;
export function tx(partial: Partial<TxInput> & Pick<TxInput, "type" | "tradeDate">): TxInput {
  return {
    id: `tx${++seq}`,
    accountId: "acc",
    instrumentId: null,
    quantity: null,
    unitPrice: null,
    amount: null,
    fees: "0",
    taxes: "0",
    currency: "EUR",
    fxRateToEur: null,
    ...partial,
  };
}

export function instrument(partial: Partial<InstrumentInput> & Pick<InstrumentInput, "id">) {
  return {
    name: partial.id,
    currency: "EUR",
    valuationMode: "market" as const,
    assetClass: "actions",
    region: null,
    ...partial,
  };
}

export function portfolio(
  partial: Partial<Omit<PortfolioData, "prices" | "fxRates">> & {
    prices?: Record<string, [string, string][]>;
    fx?: Record<string, [string, string][]>;
  },
): PortfolioData {
  return {
    accounts: partial.accounts ?? [{ id: "acc", name: "Compte", type: "cto" }],
    instruments: partial.instruments ?? [],
    transactions: partial.transactions ?? [],
    prices: new Map(
      Object.entries(partial.prices ?? {}).map(([id, pts]) => [
        id,
        pts.map(([date, close]) => ({ date, close, source: "test" })),
      ]),
    ),
    fxRates: new Map(
      Object.entries(partial.fx ?? {}).map(([cur, pts]) => [
        cur,
        pts.map(([date, rate]) => ({ date, rate, source: "test" })),
      ]),
    ),
  };
}
