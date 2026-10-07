import { describe, expect, it } from "vitest";
import { addMonths, monthEndsBetween } from "@/lib/dates";
import { parseEcbCsv } from "@/lib/market-data/ecb";
import { evaluateMetric, nextReviewDate } from "@/lib/theses";

describe("evaluateMetric", () => {
  it("constate qu'une condition est respectée ou franchie", () => {
    expect(evaluateMetric("gt", "15", "18.2")).toBe("respecte");
    expect(evaluateMetric("gt", "15", "15")).toBe("franchi");
    expect(evaluateMetric("gte", "15", "15")).toBe("respecte");
    expect(evaluateMetric("lt", "2", "2.5")).toBe("franchi");
    expect(evaluateMetric("lte", "2", null)).toBe("inconnu");
  });
});

describe("nextReviewDate", () => {
  it("prend l'échéance la plus proche", () => {
    expect(nextReviewDate({ lastReviewOn: "2026-01-15", intervalMonths: 6 })).toBe("2026-07-15");
    expect(
      nextReviewDate({
        lastReviewOn: "2026-01-15",
        intervalMonths: 6,
        nextEarningsOn: "2026-04-20",
      }),
    ).toBe("2026-04-21");
    expect(nextReviewDate({ lastReviewOn: "2026-01-15", intervalMonths: null })).toBeNull();
  });
});

describe("dates", () => {
  it("ramène au dernier jour du mois", () => {
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
  });
  it("liste les fins de mois", () => {
    expect(monthEndsBetween("2025-01-15", "2025-03-10")).toEqual([
      "2025-01-31",
      "2025-02-28",
      "2025-03-10",
    ]);
  });
});

describe("taux BCE", () => {
  it("lit le format CSV de l'API BCE", () => {
    const csv = `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-10-01,1.1712
EXR.D.GBP.EUR.SP00.A,D,GBP,EUR,SP00,A,2026-10-01,0.8701`;
    expect(parseEcbCsv(csv)).toEqual([
      { date: "2026-10-01", currency: "USD", rate: "1.1712" },
      { date: "2026-10-01", currency: "GBP", rate: "0.8701" },
    ]);
  });
});
