import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { OUTCOME_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/server/current-user";
import { loadTheses, type ThesisWithDetails } from "@/server/theses";

export const metadata = { title: "Journal de thèse" };

export default async function ThesesPage() {
  const user = await getCurrentUser();
  const all = await loadTheses(user.id);
  const asOf = today();
  const active = all.filter((t) => t.status === "active");
  const closed = all.filter((t) => t.status === "cloturee");

  return (
    <>
      <PageHeader
        title="Journal de thèse"
        description="Pourquoi vous avez acheté, ce qui prouverait que vous avez tort, et ce que vous en avez appris. Les thèses se relisent à date fixe, pas au gré des cours."
        actions={
          <Link href="/theses/nouvelle" className="btn">
            Nouvelle thèse
          </Link>
        }
      />
      {all.length === 0 ? (
        <EmptyState title="Aucune thèse pour l'instant">
          Rédiger une thèse avant d&apos;acheter aide à décider plus calmement : elle fixe à
          l&apos;avance vos critères de suivi et de sortie.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <ThesisList title={`Actives (${active.length})`} theses={active} asOf={asOf} />
          {closed.length > 0 && (
            <ThesisList title={`Clôturées (${closed.length})`} theses={closed} asOf={asOf} />
          )}
        </div>
      )}
    </>
  );
}

function ThesisList({
  title,
  theses,
  asOf,
}: {
  title: string;
  theses: ThesisWithDetails[];
  asOf: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-ink-2">{title}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {theses.map((t) => (
          <li key={t.id}>
            <Link href={`/theses/${t.id}`} className="card block p-4 hover:border-line-strong">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{t.instrument.name}</span>
                <span className="shrink-0 text-xs text-ink-2" title="Niveau de conviction (1 à 5)">
                  Conviction {t.conviction}/5
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{t.thesisText}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.status === "active" && t.nextReviewOn && (
                  <Badge tone={t.nextReviewOn <= asOf ? "warning" : "neutral"}>
                    {t.nextReviewOn <= asOf ? "À revoir depuis le" : "Revue le"}{" "}
                    {formatDate(t.nextReviewOn)}
                  </Badge>
                )}
                {t.breached.length > 0 && (
                  <Badge tone="critical">{t.breached.length} indicateur(s) hors condition</Badge>
                )}
                {t.closure && (
                  <Badge tone="neutral">
                    Thèse réalisée : {OUTCOME_LABELS[t.closure.thesisValidated].toLowerCase()}
                  </Badge>
                )}
                <Badge>Ouverte le {formatDate(t.createdAt.toISOString())}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
