import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { investmentAccounts, transactions } from "@/db/schema";
import { ClosureForm, MetricValueForm, ReviewForm } from "@/components/thesis-actions";
import { Badge, PageHeader, Section } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatDate, formatMoney, formatNumber, formatQty } from "@/lib/format";
import { OUTCOME_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { OPERATOR_LABELS } from "@/lib/theses";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/server/db";
import { loadThesis } from "@/server/theses";

export default async function ThesisPage({ params }: PageProps<"/theses/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const thesis = await loadThesis(user.id, id);
  if (!thesis) notFound();

  const accounts = await db
    .select()
    .from(investmentAccounts)
    .where(eq(investmentAccounts.userId, user.id));
  const decisions = accounts.length
    ? await db
        .select()
        .from(transactions)
        .where(
          and(
            inArray(
              transactions.accountId,
              accounts.map((a) => a.id),
            ),
            eq(transactions.instrumentId, thesis.instrumentId),
            inArray(transactions.type, ["achat", "vente"]),
          ),
        )
        .orderBy(asc(transactions.tradeDate))
    : [];
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const asOf = today();
  const active = thesis.status === "active";

  return (
    <>
      <PageHeader
        title={thesis.instrument.name}
        description={`Thèse ouverte le ${formatDate(thesis.createdAt.toISOString())}${thesis.horizonMonths ? ` · horizon prévu : ${thesis.horizonMonths} mois` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={active ? "accent" : "neutral"}>{active ? "Active" : "Clôturée"}</Badge>
            <Badge>Conviction {thesis.conviction}/5</Badge>
            {active && thesis.nextReviewOn && (
              <Badge tone={thesis.nextReviewOn <= asOf ? "warning" : "neutral"}>
                Revue {thesis.nextReviewOn <= asOf ? "attendue depuis le" : "prévue le"}{" "}
                {formatDate(thesis.nextReviewOn)}
                {thesis.reviewOnEarnings ? " ou après résultats" : ""}
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Pourquoi j'ai acheté">
            <div className="space-y-4 p-4 text-sm leading-relaxed">
              <p className="whitespace-pre-line">{thesis.thesisText}</p>
              {thesis.invalidationConditions && (
                <div>
                  <h3 className="mb-1 text-xs font-medium text-ink-2">
                    Ce qui prouverait que j&apos;ai tort
                  </h3>
                  <p className="whitespace-pre-line">{thesis.invalidationConditions}</p>
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Indicateurs clés"
            info="Chaque indicateur porte la condition attendue par la thèse. « Hors condition » est un constat sur vos critères, pas une recommandation."
          >
            {thesis.metrics.length === 0 ? (
              <p className="p-4 text-sm text-ink-2">Aucun indicateur défini.</p>
            ) : (
              <ul className="divide-y divide-line">
                {thesis.metrics.map((m) => (
                  <li key={m.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{m.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="num text-ink-2">
                          condition {OPERATOR_LABELS[m.operator]} {formatNumber(m.threshold)}
                          {m.unit ?? ""}
                        </span>
                        <Badge
                          tone={
                            m.status === "franchi"
                              ? "critical"
                              : m.status === "respecte"
                                ? "good"
                                : "neutral"
                          }
                        >
                          {m.status === "franchi"
                            ? "✕ Hors condition"
                            : m.status === "respecte"
                              ? "✓ Respectée"
                              : "Non renseignée"}
                        </Badge>
                      </span>
                    </div>
                    {m.currentValue !== null && (
                      <p className="text-ink-2">
                        Valeur :{" "}
                        <span className="num text-ink">
                          {formatNumber(m.currentValue)}
                          {m.unit ?? ""}
                        </span>{" "}
                        · source : {m.currentValueSource ?? "—"} · au{" "}
                        {formatDate(m.currentValueAsOf)}
                      </p>
                    )}
                    {active && (
                      <details>
                        <summary className="cursor-pointer text-xs text-ink-muted">
                          Mettre à jour la valeur
                        </summary>
                        <div className="mt-2">
                          <MetricValueForm metricId={m.id} />
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {active && (
            <Section
              title="Faire une revue"
              info="Relisez la thèse ci-dessus, mettez à jour les indicateurs si de nouveaux chiffres sont publiés, et notez votre constat."
            >
              <ReviewForm
                thesisId={thesis.id}
                today={asOf}
                conviction={thesis.conviction}
                metrics={thesis.metrics.map((m) => ({ id: m.id, name: m.name, unit: m.unit }))}
              />
            </Section>
          )}

          <Section title={`Revues (${thesis.reviews.length})`}>
            {thesis.reviews.length === 0 ? (
              <p className="p-4 text-sm text-ink-2">Aucune revue pour l&apos;instant.</p>
            ) : (
              <ol className="divide-y divide-line">
                {thesis.reviews.map((r) => (
                  <li key={r.id} className="px-4 py-3 text-sm">
                    <div className="mb-1 flex items-center justify-between text-xs text-ink-2">
                      <span>{formatDate(r.reviewedOn)}</span>
                      <span>Conviction après revue : {r.convictionAfter}/5</span>
                    </div>
                    <p className="whitespace-pre-line">{r.notes}</p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <div id="cloture">
            {thesis.closure ? (
              <Section title="Bilan de clôture">
                <dl className="grid gap-3 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-ink-2">Clôturée le</dt>
                    <dd>{formatDate(thesis.closure.closedOn)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-ink-2">
                      La thèse s&apos;est-elle réalisée (indépendamment du gain ou de la perte) ?
                    </dt>
                    <dd className="font-medium">
                      {OUTCOME_LABELS[thesis.closure.thesisValidated]}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-ink-2">Raison de la vente</dt>
                    <dd className="whitespace-pre-line">{thesis.closure.saleReason}</dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-ink-2">Bilan</dt>
                    <dd className="whitespace-pre-line">{thesis.closure.assessment}</dd>
                  </div>
                </dl>
              </Section>
            ) : (
              <Section
                title="Clôturer la thèse"
                info="À la vente (ou si vous abandonnez la thèse), notez la raison et jugez la thèse elle-même, pas le résultat financier."
              >
                <details>
                  <summary className="cursor-pointer px-4 py-3 text-sm text-ink-2">
                    Vous avez vendu ou abandonnez cette thèse ? Ouvrir le formulaire de bilan
                  </summary>
                  <ClosureForm thesisId={thesis.id} today={asOf} />
                </details>
              </Section>
            )}
          </div>
        </div>

        <aside>
          <Section
            title="Historique des décisions"
            info="Achats et ventes de ce titre, tous comptes confondus."
          >
            {decisions.length === 0 ? (
              <p className="p-4 text-sm text-ink-2">Aucune opération sur ce titre.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {decisions.map((d) => (
                  <li key={d.id} className="px-4 py-2.5">
                    <div className="flex justify-between">
                      <span>{TRANSACTION_TYPE_LABELS[d.type]}</span>
                      <span className="num text-ink-2">{formatDate(d.tradeDate)}</span>
                    </div>
                    <div className="num text-xs text-ink-2">
                      {formatQty(d.quantity)} × {formatMoney(d.unitPrice, d.currency)} ·{" "}
                      {accountName.get(d.accountId)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </>
  );
}
