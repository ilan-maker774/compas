import { describe, expect, it } from "vitest";
import { guessMapping, normalizeType, parseDate, parseNumber, parseRow } from "@/lib/csv-import";

describe("parseNumber", () => {
  it.each([
    ["1 234,56", "1234.56"],
    ["1.234,56", "1234.56"],
    ["1,234.56", "1234.56"],
    ["-12,5 €", "-12.5"],
    ["0,0001", "0.0001"],
    ["42", "42"],
    ["", null],
    ["abc", null],
  ])("%s → %s", (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });
});

describe("parseDate", () => {
  it.each([
    ["07/01/2025", "2025-01-07"],
    ["7.1.25", "2025-01-07"],
    ["2025-01-07", "2025-01-07"],
    ["2025-01-07T10:00:00", "2025-01-07"],
    ["31/02/2025", null],
    ["01/13/2025", null],
  ])("%s → %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });
});

describe("normalizeType", () => {
  it.each([
    ["Achat", "achat"],
    ["ACHAT COMPTANT", "achat"],
    ["Vente", "vente"],
    ["Dividende", "dividende"],
    ["Versement libre", "versement"],
    ["Droits de garde", "frais"],
    ["Opération inconnue", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeType(input)).toBe(expected);
  });
});

describe("guessMapping", () => {
  it("reconnaît des en-têtes de courtier français", () => {
    expect(
      guessMapping([
        "Date d'opération",
        "Opération",
        "Code ISIN",
        "Libellé",
        "Quantité",
        "Cours",
        "Frais",
        "Montant net",
      ]),
    ).toEqual({
      date: "Date d'opération",
      type: "Opération",
      isin: "Code ISIN",
      name: "Libellé",
      quantity: "Quantité",
      unitPrice: "Cours",
      fees: "Frais",
      amount: "Montant net",
    });
  });
});

describe("parseRow", () => {
  const mapping = guessMapping([
    "Date",
    "Type",
    "ISIN",
    "Quantité",
    "Prix",
    "Montant",
    "Frais",
    "Devise",
  ]);

  it("lit un achat", () => {
    const r = parseRow(
      {
        Date: "07/01/2025",
        Type: "Achat",
        ISIN: "lu1681043599",
        Quantité: "15",
        Prix: "520,40",
        Frais: "1,99",
        Devise: "EUR",
      },
      mapping,
    );
    expect(r).toEqual({
      ok: true,
      row: expect.objectContaining({
        tradeDate: "2025-01-07",
        type: "achat",
        isin: "LU1681043599",
        quantity: "15",
        unitPrice: "520.4",
        fees: "1.99",
      }),
    });
  });

  it("déduit le prix du montant et ignore le signe des quantités", () => {
    const r = parseRow(
      { Date: "2025-02-01", Type: "Vente", ISIN: "FR0000121014", Quantité: "-3", Montant: "-2070" },
      mapping,
    );
    expect(r.ok && r.row).toMatchObject({ type: "vente", quantity: "3", unitPrice: "690" });
  });

  it("déduit le sens du signe de la quantité en l'absence de colonne type", () => {
    const m = guessMapping(["Date", "ISIN", "Quantité", "Prix"]);
    const r = parseRow(
      { Date: "2025-02-01", ISIN: "FR0000121014", Quantité: "-3", Prix: "690" },
      m,
    );
    expect(r.ok && r.row.type).toBe("vente");
  });

  it("liste toutes les erreurs d'une ligne", () => {
    const r = parseRow(
      { Date: "hier", Type: "Achat", ISIN: "FR123", Quantité: "", Prix: "" },
      mapping,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toHaveLength(4);
  });

  it("lit un versement sans titre", () => {
    const r = parseRow({ Date: "06/01/2025", Type: "Versement", Montant: "10 000,00" }, mapping);
    expect(r.ok && r.row).toMatchObject({ type: "versement", amount: "10000", quantity: null });
  });
});
