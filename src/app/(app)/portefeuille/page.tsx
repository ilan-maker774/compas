import Link from "next/link";
import { AllocationBars } from "@/components/allocation";
import { EmptyState, InfoTip, PageHeader, Section, Signed, TextLink } from "@/components/ui";
import { formatDate, formatEur, formatMoney, formatPct, formatQty } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/server/current-user";
import { computeOverview } from "@/server/portfolio";
import { loadTheses } from "@/server/theses";

export const metadata = { title: "Portefeuille" };

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  const [overview, activeTheses] = await Promise.all([
    computeOverview(user),
    loadTheses(user.id, { status: "active" }),
  ]);
  if (overview.empty) {
    return (
      <>
        <PageHeader title="Portefeuille" />
        <EmptyState title={overview.error ? "Calcul impossible" : "Aucune position"}>
          {overview.error ?? <TextLink href="/import">Importer des opérations</TextLink>}
        </EmptyState>
      </>
    );
  }
  const { snapshot } = overview;
  const thesisByInstrument = new Map(activeTheses.map((t) => [t.instrumentId, t]));
  const total = snapshot.totalEur;

  return (
    <>
      <PageHeader
        title="Portefeuille"
        description={`Positions au ${formatDate(overview.asOf)}. Prix de revient : moyen pondéré, frais et taxes d'achat inclus, par compte.`}
      />
      <div className="space-y-6">
        {overview.accounts.map((account) => {
          const lines = snapshot.lines
            .filter((l) => l.accountId === account.id)
            .sort((a, b) => b.valueEur.cmp(a.valueEur));
          const cash = snapshot.cashByAccount.get(account.id);
          if (lines.length === 0 && !cash) return null;
          const accountTotal = lines.reduce(
            (s, l) => s.plus(l.valueEur),
            cash ?? snapshot.cashEur.mul(0),
          );
          return (
            <Section
              key={account.id}
              title={
                account.name === ACCOUNT_TYPE_LABELS[account.type] ||
                account.name === account.type.toUpperCase()
                  ? account.name
                  : `${account.name} · ${ACCOUNT_TYPE_LABELS[account.type]}`
              }
              actions={
                <span className="num text-sm font-medium">
                  {formatEur(accountTotal.toNumber())}
                </span>
              }
            >
              <div className="overflow-x-auto">
                <table className="table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th className="text-right">Quantité</th>
                      <th className="text-right">
                        PRU (€)
                        <InfoTip>
                          Prix de revient unitaire : coût total d&apos;acquisition (frais et taxes
                          inclus) divisé par la quantité détenue, en euros.
                        </InfoTip>
                      </th>
                      <th className="text-right">
                        Cours
                        <InfoTip>
                          Dernier cours de clôture connu, dans la devise de cotation. Survolez la
                          date pour sa source.
                        </InfoTip>
                      </th>
                      <th className="text-right">Valeur (€)</th>
                      <th className="text-right">+/− latente</th>
                      <th className="text-right">Poids</th>
                      <th>Thèse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const pct = l.costEur.isZero()
                        ? null
                        : l.unrealizedEur.div(l.costEur).toNumber();
                      const thesis = thesisByInstrument.get(l.instrumentId);
                      return (
                        <tr key={`${l.accountId}-${l.instrumentId}`}>
                          <td>
                            <Link
                              href={`/instruments/${l.instrumentId}`}
                              className="hover:underline"
                            >
                              {l.instrument.name}
                            </Link>
                          </td>
                          <td className="num text-right">{formatQty(l.quantity.toNumber())}</td>
                          <td className="num text-right">
                            {formatEur(l.costEur.div(l.quantity).toNumber())}
                          </td>
                          <td className="num text-right">
                            {formatMoney(l.price.toNumber(), l.instrument.currency)}
                            <div
                              className="text-[11px] text-ink-muted"
                              title={`Source : ${l.priceSource}${l.instrument.currency !== "EUR" ? ` · taux 1 € = ${l.fxRate.toFixed(4)} ${l.instrument.currency} (${formatDate(l.fxDate)})` : ""}`}
                            >
                              {formatDate(l.priceDate)} · {l.priceSource}
                            </div>
                          </td>
                          <td className="num text-right">{formatEur(l.valueEur.toNumber())}</td>
                          <td className="text-right">
                            <Signed value={l.unrealizedEur}>
                              {formatEur(l.unrealizedEur.toNumber(), { sign: true })}
                              <div className="text-[11px]">{formatPct(pct, { sign: true })}</div>
                            </Signed>
                          </td>
                          <td className="num text-right">
                            {formatPct(l.valueEur.div(total).toNumber(), { digits: 1 })}
                          </td>
                          <td>
                            {thesis ? (
                              <TextLink href={`/theses/${thesis.id}`}>Relire</TextLink>
                            ) : (
                              <Link
                                href={`/theses/nouvelle?instrument=${l.instrumentId}`}
                                className="text-xs text-ink-muted hover:underline"
                              >
                                Rédiger
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {cash && !cash.isZero() && (
                      <tr>
                        <td className="text-ink-2">Liquidités</td>
                        <td colSpan={3} />
                        <td className="num text-right">{formatEur(cash.toNumber())}</td>
                        <td />
                        <td className="num text-right">
                          {formatPct(cash.div(total).toNumber(), { digits: 1 })}
                        </td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          );
        })}

        <div className="grid gap-6 md:grid-cols-3">
          <Section
            title="Par zone géographique"
            info="Zone déclarée pour chaque instrument (un ETF MSCI World compte en « Monde »). L'exposition réelle titre par titre des ETF viendra en V2."
          >
            <AllocationBars slices={overview.allocation.region} />
          </Section>
          <Section
            title="Par devise"
            info="Devise de cotation des instruments. Les liquidités sont en euros."
          >
            <AllocationBars slices={overview.allocation.currency} />
          </Section>
          <Section
            title="Par classe d'actifs"
            info="Classe d'actifs déclarée pour chaque instrument."
          >
            <AllocationBars slices={overview.allocation.assetClass} />
          </Section>
        </div>
      </div>
    </>
  );
}
