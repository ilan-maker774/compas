import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { instruments, investmentAccounts, theses, transactions } from "@/db/schema";
import { EmptyState, Notice, PageHeader, TextLink } from "@/components/ui";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { deleteTransaction } from "@/server/actions/transactions";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/server/db";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const accountFilter = typeof params.compte === "string" ? params.compte : undefined;
  const typeFilter = typeof params.type === "string" ? params.type : undefined;

  const accounts = await db
    .select()
    .from(investmentAccounts)
    .where(eq(investmentAccounts.userId, user.id));
  const accountIds = accounts
    .map((a) => a.id)
    .filter((id) => !accountFilter || id === accountFilter);
  const rows = accountIds.length
    ? await db
        .select({ tx: transactions, instrument: instruments })
        .from(transactions)
        .leftJoin(instruments, eq(transactions.instrumentId, instruments.id))
        .where(
          and(
            inArray(transactions.accountId, accountIds),
            typeFilter
              ? eq(transactions.type, typeFilter as (typeof transactions.type.enumValues)[number])
              : undefined,
          ),
        )
        .orderBy(desc(transactions.tradeDate), desc(transactions.createdAt))
        .limit(500)
    : [];
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  // Invitations du journal de thèse (jamais obligatoires).
  const newPosition =
    typeof params.nouvelle_position === "string" ? params.nouvelle_position : null;
  const [newInstrument] = newPosition
    ? await db.select().from(instruments).where(eq(instruments.id, newPosition))
    : [];
  const closedThesisId = typeof params.position_soldee === "string" ? params.position_soldee : null;
  const [closedThesis] = closedThesisId
    ? await db
        .select()
        .from(theses)
        .where(and(eq(theses.id, closedThesisId), eq(theses.userId, user.id)))
    : [];

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Toutes vos opérations, de la plus récente à la plus ancienne."
        actions={
          <>
            <Link href="/import" className="btn-ghost">
              Importer un CSV
            </Link>
            <Link href="/transactions/nouvelle" className="btn">
              Nouvelle opération
            </Link>
          </>
        }
      />
      <div className="mb-4 space-y-2">
        {params.ajoutee && <Notice>Opération enregistrée.</Notice>}
        {newInstrument && (
          <Notice>
            Nouvelle position sur <strong>{newInstrument.name}</strong>. Souhaitez-vous noter
            pourquoi vous l&apos;achetez ?{" "}
            <TextLink href={`/theses/nouvelle?instrument=${newInstrument.id}`}>
              Rédiger une thèse
            </TextLink>{" "}
            (facultatif).
          </Notice>
        )}
        {closedThesis && (
          <Notice>
            Position soldée. Votre thèse est toujours active :{" "}
            <TextLink href={`/theses/${closedThesis.id}#cloture`}>
              la clôturer avec un bilan
            </TextLink>{" "}
            (facultatif).
          </Notice>
        )}
      </div>

      <form className="mb-4 flex flex-wrap gap-2 text-sm" action="/transactions">
        <select name="compte" defaultValue={accountFilter ?? ""} className="field w-auto">
          <option value="">Tous les comptes</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={typeFilter ?? ""} className="field w-auto">
          <option value="">Tous les types</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn-ghost" type="submit">
          Filtrer
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Aucune opération">
          <TextLink href="/import">Importez un fichier CSV</TextLink> ou{" "}
          <TextLink href="/transactions/nouvelle">saisissez une opération</TextLink>.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[820px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Compte</th>
                <th>Type</th>
                <th>Titre</th>
                <th className="text-right">Quantité</th>
                <th className="text-right">Prix</th>
                <th className="text-right">Montant</th>
                <th className="text-right">Frais / taxes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tx, instrument }) => (
                <tr key={tx.id}>
                  <td className="num">{formatDate(tx.tradeDate)}</td>
                  <td className="text-ink-2">{accountName.get(tx.accountId)}</td>
                  <td>{TRANSACTION_TYPE_LABELS[tx.type]}</td>
                  <td>
                    {instrument?.name ?? <span className="text-ink-muted">{tx.notes ?? "—"}</span>}
                  </td>
                  <td className="num text-right">{tx.quantity ? formatQty(tx.quantity) : ""}</td>
                  <td className="num text-right">
                    {tx.unitPrice ? formatMoney(tx.unitPrice, tx.currency) : ""}
                  </td>
                  <td className="num text-right">
                    {tx.amount ? formatMoney(tx.amount, tx.currency) : ""}
                  </td>
                  <td className="num text-right text-ink-2">
                    {Number(tx.fees) || Number(tx.taxes)
                      ? `${formatMoney(tx.fees, tx.currency)} / ${formatMoney(tx.taxes, tx.currency)}`
                      : ""}
                  </td>
                  <td className="text-right">
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={tx.id} />
                      <button
                        className="text-xs text-ink-muted hover:text-critical"
                        aria-label="Supprimer l'opération"
                      >
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
