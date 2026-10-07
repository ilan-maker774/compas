import { sql } from "drizzle-orm";
import Link from "next/link";
import { prices } from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { ASSET_CLASS_LABELS, INSTRUMENT_TYPE_LABELS, REGION_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/server/db";
import { loadInstruments } from "@/server/portfolio";

export const metadata = { title: "Instruments" };

export default async function InstrumentsPage() {
  const user = await getCurrentUser();
  const list = await loadInstruments(user.id);
  const last = await db
    .select({ id: prices.instrumentId, date: sql<string>`max(${prices.date})` })
    .from(prices)
    .groupBy(prices.instrumentId);
  const lastDate = new Map(last.map((l) => [l.id, l.date]));

  return (
    <>
      <PageHeader
        title="Instruments"
        description="Titres, fonds et supports suivis. Complétez la classe d'actifs et la zone pour une répartition exacte."
        actions={
          <Link href="/instruments/nouveau" className="btn">
            Ajouter un instrument
          </Link>
        }
      />
      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th>Nom</th>
              <th>ISIN</th>
              <th>Type</th>
              <th>Classe</th>
              <th>Zone</th>
              <th>Devise</th>
              <th>Dernier cours</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link href={`/instruments/${i.id}`} className="hover:underline">
                    {i.name}
                  </Link>{" "}
                  {i.ownerUserId && <Badge>personnel</Badge>}
                </td>
                <td className="num text-ink-2">{i.isin ?? "—"}</td>
                <td>{INSTRUMENT_TYPE_LABELS[i.type]}</td>
                <td>{ASSET_CLASS_LABELS[i.assetClass]}</td>
                <td>
                  {i.region ? (
                    REGION_LABELS[i.region]
                  ) : (
                    <span className="text-ink-muted">non renseignée</span>
                  )}
                </td>
                <td>{i.currency}</td>
                <td className="num text-ink-2">
                  {i.valuationMode === "nominal"
                    ? "valeur nominale"
                    : formatDate(lastDate.get(i.id))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
