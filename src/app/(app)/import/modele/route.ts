const TEMPLATE = `Date;Type;ISIN;Libellé;Quantité;Prix;Montant;Frais;Taxes;Devise
06/01/2025;Versement;;;;;5000,00;;;EUR
07/01/2025;Achat;LU1681043599;Amundi MSCI World;8;520,40;;1,99;;EUR
10/02/2025;Achat;FR0000121014;LVMH;2;690,00;;1,99;5,52;EUR
25/04/2025;Dividende;FR0000121014;LVMH;;;26,00;;;EUR
`;

export function GET() {
  return new Response("﻿" + TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="compas-modele-import.csv"',
    },
  });
}
