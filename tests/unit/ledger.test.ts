import { describe, expect, it } from "vitest";
import { snapshot } from "@/lib/finance/portfolio";
import { instrument, portfolio, tx } from "./helpers";

describe("prix de revient et plus-values", () => {
  const data = portfolio({
    instruments: [instrument({ id: "A" })],
    transactions: [
      tx({
        type: "achat",
        tradeDate: "2025-01-02",
        instrumentId: "A",
        quantity: "10",
        unitPrice: "100",
        fees: "5",
      }),
      tx({
        type: "achat",
        tradeDate: "2025-02-03",
        instrumentId: "A",
        quantity: "10",
        unitPrice: "120",
        fees: "5",
      }),
      tx({
        type: "vente",
        tradeDate: "2025-03-03",
        instrumentId: "A",
        quantity: "5",
        unitPrice: "130",
        fees: "5",
      }),
    ],
    prices: { A: [["2025-03-31", "125"]] },
  });

  it("calcule le PRU moyen pondéré frais inclus", () => {
    const s = snapshot(data, "2025-03-31");
    const line = s.lines[0];
    expect(line.quantity.toString()).toBe("15");
    expect(line.costEur.toString()).toBe("1657.5");
    expect(line.costEur.div(line.quantity).toString()).toBe("110.5");
  });

  it("réalise la plus-value à la vente sans modifier le PRU restant", () => {
    const s = snapshot(data, "2025-03-31");
    // Produit net 5 × 130 − 5 = 645 ; coût sorti 5 × 110,5 = 552,5.
    expect(s.realizedEur.toString()).toBe("92.5");
    expect(s.unrealizedEur.toString()).toBe("217.5"); // 15 × 125 − 1657,5
    expect(s.feesEur.toString()).toBe("15");
  });

  it("valorise au dernier prix de transaction tant qu'aucun cours plus récent n'existe", () => {
    const s = snapshot(data, "2025-03-10");
    expect(s.lines[0].price.toString()).toBe("130");
    expect(s.lines[0].priceSource).toBe("dernière transaction");
  });

  it("signale une vente supérieure à la quantité détenue", () => {
    const d = portfolio({
      instruments: [instrument({ id: "A" })],
      transactions: [
        tx({
          type: "achat",
          tradeDate: "2025-01-02",
          instrumentId: "A",
          quantity: "1",
          unitPrice: "10",
        }),
        tx({
          type: "vente",
          tradeDate: "2025-01-03",
          instrumentId: "A",
          quantity: "2",
          unitPrice: "10",
        }),
      ],
    });
    expect(snapshot(d, "2025-01-31").warnings).toHaveLength(1);
  });
});

describe("devises", () => {
  const data = portfolio({
    instruments: [instrument({ id: "MSFT", currency: "USD" })],
    transactions: [
      tx({
        type: "achat",
        tradeDate: "2025-01-02",
        instrumentId: "MSFT",
        quantity: "10",
        unitPrice: "100",
        currency: "USD",
        fxRateToEur: "1.25",
      }),
      tx({
        type: "dividende",
        tradeDate: "2025-02-03",
        instrumentId: "MSFT",
        amount: "22",
        taxes: "3.3",
        currency: "USD",
      }),
    ],
    prices: { MSFT: [["2025-03-31", "110"]] },
    fx: {
      USD: [
        ["2025-01-31", "1.20"],
        ["2025-03-28", "1.10"],
      ],
    },
  });

  it("convertit le coût au taux appliqué et la valeur au dernier taux BCE", () => {
    const s = snapshot(data, "2025-03-31");
    expect(s.lines[0].costEur.toString()).toBe("800"); // 1000 USD / 1,25
    expect(s.lines[0].valueEur.toString()).toBe("1000"); // 1100 USD / 1,10
    expect(s.unrealizedEur.toString()).toBe("200");
  });

  it("convertit le dividende net au taux BCE du jour", () => {
    const s = snapshot(data, "2025-03-31");
    expect(s.incomeEur.toFixed(4)).toBe("15.5833"); // (22 − 3,3) / 1,20
    expect(s.taxesEur.toFixed(4)).toBe("2.7500");
  });

  it("refuse de calculer sans taux de change", () => {
    expect(() => snapshot(data, "2025-01-15")).toThrow(/taux de change USD/);
  });
});

describe("fonds euros", () => {
  it("capitalise les intérêts en revenus sans plus-value latente", () => {
    const data = portfolio({
      instruments: [instrument({ id: "FE", valuationMode: "nominal", assetClass: "fonds_euros" })],
      transactions: [
        tx({ type: "versement", tradeDate: "2025-01-02", amount: "5000" }),
        tx({
          type: "achat",
          tradeDate: "2025-01-02",
          instrumentId: "FE",
          quantity: "5000",
          unitPrice: "1",
        }),
        tx({
          type: "interets",
          tradeDate: "2025-12-31",
          instrumentId: "FE",
          amount: "125",
          quantity: "125",
        }),
      ],
    });
    const s = snapshot(data, "2025-12-31");
    expect(s.totalEur.toString()).toBe("5125");
    expect(s.cashEur.toString()).toBe("0");
    expect(s.incomeEur.toString()).toBe("125");
    expect(s.unrealizedEur.toString()).toBe("0");
  });
});

describe("liquidités", () => {
  it("suit les espèces des comptes ayant des versements", () => {
    const data = portfolio({
      instruments: [instrument({ id: "A" })],
      transactions: [
        tx({ type: "versement", tradeDate: "2025-01-02", amount: "1000" }),
        tx({
          type: "achat",
          tradeDate: "2025-01-02",
          instrumentId: "A",
          quantity: "5",
          unitPrice: "100",
          fees: "2",
        }),
        tx({ type: "frais", tradeDate: "2025-01-31", amount: "3" }),
      ],
    });
    const s = snapshot(data, "2025-01-31");
    expect(s.cashEur.toString()).toBe("495");
    expect(s.totalEur.toString()).toBe("995");
    expect(s.feesEur.toString()).toBe("5");
    expect(s.netInvestedEur.toString()).toBe("1000");
  });
});
