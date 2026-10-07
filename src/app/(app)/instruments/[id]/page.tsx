import { and, desc, eq, isNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { instruments, prices } from "@/db/schema";
import { InstrumentForm, ManualPriceForm } from "@/components/instrument-form";
import { Badge, PageHeader, Section } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { ASSET_CLASS_LABELS, INSTRUMENT_TYPE_LABELS, REGION_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/server/db";

export default async function InstrumentPage({ params }: PageProps<"/instruments/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [inst] = await db
    .select()
    .from(instruments)
    .where(
      and(
        eq(instruments.id, id),
        or(isNull(instruments.ownerUserId), eq(instruments.ownerUserId, user.id)),
      ),
    );
  if (!inst) notFound();
  const recent = await db
    .select()
    .from(prices)
    .where(eq(prices.instrumentId, id))
    .orderBy(desc(prices.date))
    .limit(12);
  const editable = inst.ownerUserId === user.id;

  return (
    <>
      <PageHeader
        title={inst.name}
        description={[inst.isin, inst.ticker, INSTRUMENT_TYPE_LABELS[inst.type], inst.currency]
          .filter(Boolean)
          .join(" · ")}
        actions={editable ? <Badge>personnel</Badge> : <Badge>référence partagée</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Caractéristiques">
          {editable ? (
            <InstrumentForm instrument={inst} />
          ) : (
            <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
              <dt className="text-ink-2">Classe d&apos;actifs</dt>
              <dd>{ASSET_CLASS_LABELS[inst.assetClass]}</dd>
              <dt className="text-ink-2">Zone</dt>
              <dd>{inst.region ? REGION_LABELS[inst.region] : "—"}</dd>
              <dt className="text-ink-2">Pays</dt>
              <dd>{inst.country ?? "—"}</dd>
              <dt className="text-ink-2">Secteur</dt>
              <dd>{inst.sector ?? "—"}</dd>
              <dt className="text-ink-2">Codes fournisseurs</dt>
              <dd>
                {Object.entries(inst.providerRefs)
                  .map(([k, v]) => `${k} : ${v}`)
                  .join(", ") || "—"}
              </dd>
            </dl>
          )}
        </Section>
        <Section
          title="Derniers cours de clôture"
          info="Un cours par jour au plus, avec sa source. Les instruments partagés sont mis à jour par la tâche quotidienne ; les vôtres, par saisie manuelle."
        >
          {inst.valuationMode === "nominal" ? (
            <p className="p-4 text-sm text-ink-2">
              Fonds euros : valorisé à sa valeur nominale (1 part = 1 €). Les intérêts crédités
              s&apos;enregistrent comme opération « Intérêts ».
            </p>
          ) : (
            <>
              {editable && <ManualPriceForm instrumentId={inst.id} today={today()} />}
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Clôture</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.date}>
                      <td className="num">{formatDate(p.date)}</td>
                      <td className="num text-right">{formatMoney(p.close, inst.currency)}</td>
                      <td className="text-ink-2">{p.source}</td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-ink-2">
                        Aucun cours. Le dernier prix de transaction est utilisé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
