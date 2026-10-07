import { count, inArray } from "drizzle-orm";
import { transactions } from "@/db/schema";
import { AccountForm } from "@/components/account-form";
import { PageHeader, Section } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { deleteAccount } from "@/server/actions/accounts";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/server/db";
import { loadAccounts } from "@/server/portfolio";

export const metadata = { title: "Comptes" };

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const accounts = await loadAccounts(user.id);
  const counts = accounts.length
    ? await db
        .select({ id: transactions.accountId, n: count() })
        .from(transactions)
        .where(
          inArray(
            transactions.accountId,
            accounts.map((a) => a.id),
          ),
        )
        .groupBy(transactions.accountId)
    : [];
  const countOf = new Map(counts.map((c) => [c.id, c.n]));

  return (
    <>
      <PageHeader
        title="Comptes"
        description="PEA, compte-titres, assurance-vie, PER… Compas ne se connecte à aucune banque : aucun identifiant n'est stocké."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title={`Vos comptes (${accounts.length})`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Établissement</th>
                  <th>Ouvert le</th>
                  <th className="text-right">Opérations</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.name}</td>
                    <td>{ACCOUNT_TYPE_LABELS[a.type]}</td>
                    <td className="text-ink-2">{a.institution ?? "—"}</td>
                    <td className="num text-ink-2">{formatDate(a.openedOn)}</td>
                    <td className="num text-right">{countOf.get(a.id) ?? 0}</td>
                    <td className="text-right">
                      <form action={deleteAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          className="text-xs text-ink-muted hover:text-critical"
                          title="Supprime le compte et toutes ses opérations"
                        >
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-ink-2">
                      Aucun compte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        </div>
        <Section title="Nouveau compte">
          <AccountForm />
        </Section>
      </div>
    </>
  );
}
