import Link from "next/link";
import { AllocationBars } from "@/components/allocation";
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  Section,
  Signed,
  Stat,
  TextLink,
} from "@/components/ui";
import { ValueChart } from "@/components/value-chart";
import { formatDate, formatEur, formatNumber, formatPct } from "@/lib/format";
import { OPERATOR_LABELS } from "@/lib/theses";
import { getCurrentUser } from "@/server/current-user";
import { computeOverview, PERIODS, type PeriodKey } from "@/server/portfolio";
import { loadTheses } from "@/server/theses";
import { today } from "@/lib/dates";

export const metadata = { title: "Tableau de bord" };

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const period = (PERIODS.find((p) => p.key === params.periode)?.key ?? "MAX") as PeriodKey;
  const [overview, activeTheses] = await Promise.all([
    computeOverview(user, period),
    loadTheses(user.id, { status: "active" }),
  ]);

  const asOf = today();
  const toReview = activeTheses.filter((t) => t.nextReviewOn && t.nextReviewOn <= asOf);
  const alerts = activeTheses.flatMap((t) => t.breached.map((m) => ({ thesis: t, metric: m })));

  return (
    <>
      <PageHeader
        title={`Bonjour${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={`Situation au ${formatDate(asOf)}, calculée sur les cours de clôture. Aucun cours intraday.`}
      />

      {overview.empty ? (
        <EmptyState title={overview.error ? "Calcul impossible" : "Votre portefeuille est vide"}>
          {overview.error ? (
            <p>{overview.error}. Ajoutez ce taux ou lancez la mise à jour quotidienne.</p>
          ) : (
            <p>
              Commencez par <TextLink href="/comptes">créer un compte</TextLink>, puis{" "}
              <TextLink href="/import">importez vos opérations</TextLink> ou{" "}
              <TextLink href="/transactions/nouvelle">saisissez-les</TextLink>.
            </p>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <nav aria-label="Période" className="flex flex-wrap gap-1 text-sm">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={p.key === "MAX" ? "/" : `/?periode=${p.key}`}
                aria-current={p.key === period ? "true" : undefined}
                className={`rounded-md border px-2.5 py-1 ${
                  p.key === period
                    ? "border-accent bg-accent/10 text-accent-ink"
                    : "border-line text-ink-2 hover:bg-surface-2"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </nav>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Patrimoine suivi"
              value={formatEur(overview.snapshot.totalEur.toNumber(), { decimals: false })}
              sub={`dont ${formatEur(overview.snapshot.cashEur.toNumber(), { decimals: false })} de liquidités`}
              info="Somme des positions valorisées au dernier cours de clôture connu (converti en euros au dernier taux BCE) et des liquidités des comptes dont vous suivez les versements."
              source={`Capital net investi : ${formatEur(overview.snapshot.netInvestedEur.toNumber(), { decimals: false })}`}
            />
            <Stat
              label="Plus-values latentes"
              value={
                <Signed value={overview.snapshot.unrealizedEur}>
                  {formatEur(overview.snapshot.unrealizedEur.toNumber(), {
                    sign: true,
                    decimals: false,
                  })}
                </Signed>
              }
              sub={formatPct(
                overview.snapshot.costEur.isZero()
                  ? null
                  : overview.snapshot.unrealizedEur.div(overview.snapshot.costEur).toNumber(),
                { sign: true },
              )}
              info="Valeur actuelle des positions moins leur prix de revient (prix moyen pondéré d'achat, frais et taxes inclus, en euros au taux de change de chaque achat)."
              source={`Réalisées : ${formatEur(overview.snapshot.realizedEur.toNumber(), { sign: true, decimals: false })} · revenus nets : ${formatEur(overview.snapshot.incomeEur.toNumber(), { decimals: false })}`}
            />
            <Stat
              label="Performance (TWR)"
              value={
                <Signed value={overview.performance.twr}>
                  {formatPct(overview.performance.twr, { sign: true })}
                </Signed>
              }
              sub={
                overview.performance.twrAnnualized !== null
                  ? `${formatPct(overview.performance.twrAnnualized, { sign: true })} par an`
                  : `du ${formatDate(overview.from)} au ${formatDate(overview.asOf)}`
              }
              info="Performance pondérée par le temps : mesure la qualité des placements en neutralisant le calendrier et le montant de vos versements. C'est elle qui se compare à un indice."
              source={
                overview.performance.benchmark
                  ? `${overview.performance.benchmark.name} : ${formatPct(overview.performance.benchmark.value, { sign: true })} sur la même période`
                  : "Aucun indice de référence choisi (Paramètres)"
              }
            />
            <Stat
              label="Rendement de votre argent (TRI)"
              value={
                <Signed value={overview.performance.mwr}>
                  {formatPct(overview.performance.mwr, { sign: true })}
                </Signed>
              }
              sub="annualisé"
              info="Performance pondérée par l'argent (TRI, équivalent de la fonction XIRR d'Excel) : tient compte du moment et du montant de chaque versement. C'est le rendement réellement obtenu sur vos euros."
              source={`Frais payés depuis l'origine : ${formatEur(overview.snapshot.feesEur.toNumber())} · taxes : ${formatEur(overview.snapshot.taxesEur.toNumber())}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Section
                title="Évolution mensuelle"
                info="Valeur du portefeuille en fin de mois et capital net investi (versements moins retraits ; sur les comptes sans suivi des espèces, achats moins ventes). L'écart entre les deux courbes est votre gain ou perte cumulé."
              >
                <ValueChart points={overview.timeline} />
              </Section>
            </div>
            <div className="space-y-6">
              <Section
                title="Thèses à revoir"
                info="Thèses dont la date de revue programmée est atteinte. Relire une thèse, c'est vérifier si ses raisons tiennent toujours, indépendamment du cours."
                actions={<TextLink href="/theses">Journal</TextLink>}
              >
                {toReview.length === 0 ? (
                  <p className="p-4 text-sm text-ink-2">Aucune revue en attente.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {toReview.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                      >
                        <Link href={`/theses/${t.id}`} className="hover:underline">
                          {t.instrument.name}
                        </Link>
                        <Badge tone="warning">prévue le {formatDate(t.nextReviewOn)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section
                title="Alertes sur thèse"
                info="Un indicateur clé ne respecte plus la condition que vous aviez fixée. C'est un constat sur vos propres critères, pas une recommandation."
              >
                {alerts.length === 0 ? (
                  <p className="p-4 text-sm text-ink-2">
                    Tous les indicateurs renseignés respectent vos conditions.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {alerts.map(({ thesis, metric }) => (
                      <li key={metric.id} className="px-4 py-2.5 text-sm">
                        <Link href={`/theses/${thesis.id}`} className="font-medium hover:underline">
                          {thesis.instrument.name}
                        </Link>
                        <p className="text-ink-2">
                          {metric.name} : {formatNumber(metric.currentValue)}
                          {metric.unit ?? ""} — condition {OPERATOR_LABELS[metric.operator]}{" "}
                          {formatNumber(metric.threshold)}
                          {metric.unit ?? ""} non respectée.
                        </p>
                        <p className="text-xs text-ink-muted">
                          Source : {metric.currentValueSource ?? "—"} (
                          {formatDate(metric.currentValueAsOf)})
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Section
              title="Répartition par compte"
              info="Valeur de chaque compte, liquidités comprises."
            >
              <AllocationBars slices={overview.allocation.account} />
            </Section>
            <Section
              title="Répartition par classe d'actifs"
              info="Classe d'actifs déclarée pour chaque instrument (un ETF actions compte en actions). Détail par zone et devise dans Portefeuille."
            >
              <AllocationBars slices={overview.allocation.assetClass} />
            </Section>
          </div>

          {overview.snapshot.warnings.length > 0 && (
            <Notice tone="warning">
              {overview.snapshot.warnings.length} anomalie(s) dans l&apos;historique :{" "}
              {overview.snapshot.warnings.map((w) => w.message).join(" ; ")}
            </Notice>
          )}
        </div>
      )}
    </>
  );
}
