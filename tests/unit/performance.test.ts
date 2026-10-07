import { describe, expect, it } from "vitest";
import {
  allocate,
  annualize,
  benchmarkReturn,
  buildTimeline,
  moneyWeighted,
  snapshot,
  twr,
} from "@/lib/finance/portfolio";
import { instrument, portfolio, tx } from "./helpers";

/**
 * Cas de référence calculé à la main (et vérifiable dans Excel) :
 * - 01/01 : versement 1 000, achat 10 × 100. Valeur 1 000.
 * - 01/02 : cours 110, nouveau versement 1 100 laissé en espèces. Valeur 2 200.
 *   Sous-période : (2 200 − 1 100) / 1 000 = +10 %.
 * - 01/03 : cours 99. Valeur 990 + 1 100 = 2 090. Sous-période : 2 090 / 2 200 = −5 %.
 * TWR = 1,10 × 0,95 − 1 = +4,5 %. TRI (XIRR Excel de −1 000 ; −1 100 ; +2 090) = −3,9936 %.
 */
const data = portfolio({
  instruments: [instrument({ id: "A" })],
  transactions: [
    tx({ type: "versement", tradeDate: "2025-01-01", amount: "1000" }),
    tx({
      type: "achat",
      tradeDate: "2025-01-01",
      instrumentId: "A",
      quantity: "10",
      unitPrice: "100",
    }),
    tx({ type: "versement", tradeDate: "2025-02-01", amount: "1100" }),
  ],
  prices: {
    A: [
      ["2025-01-01", "100"],
      ["2025-02-01", "110"],
      ["2025-03-01", "99"],
    ],
  },
});

describe("performance", () => {
  const { points } = buildTimeline(data, ["2025-03-01"]);

  it("valorise à chaque date de flux", () => {
    expect(points.map((p) => [p.date, p.valueEur.toString(), p.flowEur.toString()])).toEqual([
      ["2025-01-01", "1000", "1000"],
      ["2025-02-01", "2200", "1100"],
      ["2025-03-01", "2090", "0"],
    ]);
    expect(points.at(-1)!.investedEur.toString()).toBe("2100");
  });

  it("calcule le TWR", () => {
    expect(twr(points, "2024-12-31", "2025-03-01")).toBeCloseTo(0.045, 12);
  });

  it("calcule le TWR sur une sous-période", () => {
    expect(twr(points, "2025-02-01", "2025-03-01")).toBeCloseTo(-0.05, 12);
  });

  it("calcule le TRI (XIRR)", () => {
    expect(moneyWeighted(points, "2024-12-31", "2025-03-01")).toBeCloseTo(-0.0399363725, 8);
  });

  it("n'est pas affecté par des achats sur un compte sans suivi des espèces", () => {
    // Même historique de cours, mais les achats sont les apports : TWR identique au cours du titre.
    const d = portfolio({
      instruments: [instrument({ id: "A" })],
      transactions: [
        tx({
          type: "achat",
          tradeDate: "2025-01-01",
          instrumentId: "A",
          quantity: "10",
          unitPrice: "100",
        }),
        tx({
          type: "achat",
          tradeDate: "2025-02-01",
          instrumentId: "A",
          quantity: "10",
          unitPrice: "110",
        }),
      ],
      prices: {
        A: [
          ["2025-01-01", "100"],
          ["2025-02-01", "110"],
          ["2025-03-01", "99"],
        ],
      },
    });
    const t = buildTimeline(d, ["2025-03-01"]);
    expect(twr(t.points, "2024-12-31", "2025-03-01")).toBeCloseTo(-0.01, 12); // 99 / 100 − 1
  });
});

describe("benchmark", () => {
  it("convertit l'indice en euros", () => {
    const d = portfolio({
      prices: {
        SPX: [
          ["2025-01-01", "100"],
          ["2025-12-31", "110"],
        ],
      },
      fx: {
        USD: [
          ["2025-01-01", "1.00"],
          ["2025-12-31", "1.10"],
        ],
      },
    });
    // 110 USD / 1,10 = 100 EUR : aucune performance en euros.
    expect(
      benchmarkReturn(d, { id: "SPX", currency: "USD" }, "2025-01-01", "2025-12-31"),
    ).toBeCloseTo(0, 12);
  });
});

describe("annualisation", () => {
  it("n'annualise pas une période de moins d'un an", () => {
    expect(annualize(0.05, "2025-01-01", "2025-06-30")).toBeNull();
  });
  it("annualise sur deux ans", () => {
    expect(annualize(0.21, "2023-01-01", "2025-01-01")).toBeCloseTo(0.0997, 3);
  });
});

describe("répartition", () => {
  it("pondère les lignes et les liquidités", () => {
    const s = snapshot(data, "2025-03-01");
    const slices = allocate(s.lines, s.cashEur, (l) => l.instrument.assetClass, "liquidites");
    expect(slices.map((x) => [x.key, x.valueEur.toString()])).toEqual([
      ["liquidites", "1100"],
      ["actions", "990"],
    ]);
    expect(slices[0].weight + slices[1].weight).toBeCloseTo(1, 12);
  });
});
