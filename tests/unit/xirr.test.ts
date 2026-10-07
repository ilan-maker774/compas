import { describe, expect, it } from "vitest";
import { dec } from "@/lib/finance/series";
import { xirr } from "@/lib/finance/xirr";

const f = (date: string, amount: number) => ({ date, amount: dec(amount) });

describe("xirr", () => {
  it("reproduit l'exemple de la documentation Excel (XIRR = 37,34 %)", () => {
    const r = xirr([
      f("2008-01-01", -10000),
      f("2008-03-01", 2750),
      f("2008-10-30", 4250),
      f("2009-02-15", 3250),
      f("2009-04-01", 2750),
    ]);
    expect(r).toBeCloseTo(0.373362535, 8);
  });

  it("donne 10 % pour un placement qui gagne 10 % en exactement un an", () => {
    expect(xirr([f("2023-01-01", -1000), f("2024-01-01", 1100)])).toBeCloseTo(0.1, 10);
  });

  it("gère les rendements négatifs", () => {
    expect(xirr([f("2023-01-01", -1000), f("2024-01-01", 500)])).toBeCloseTo(-0.5, 8);
  });

  it("renvoie null quand tous les flux ont le même signe", () => {
    expect(xirr([f("2023-01-01", -1000), f("2024-01-01", -500)])).toBeNull();
  });
});
