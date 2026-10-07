import { PageHeader } from "@/components/ui";
import { TransactionForm } from "@/components/transaction-form";
import { today } from "@/lib/dates";
import { getCurrentUser } from "@/server/current-user";
import { loadAccounts, loadInstruments } from "@/server/portfolio";

export const metadata = { title: "Nouvelle opération" };

export default async function NewTransactionPage() {
  const user = await getCurrentUser();
  const [accounts, instruments] = await Promise.all([
    loadAccounts(user.id),
    loadInstruments(user.id),
  ]);
  return (
    <>
      <PageHeader
        title="Nouvelle opération"
        description="Saisissez les montants tels qu'ils figurent sur votre avis d'opéré, dans la devise de l'opération."
      />
      <TransactionForm
        today={today()}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        instruments={instruments
          .filter((i) => i.type !== "indice")
          .map((i) => ({ id: i.id, name: i.name, isin: i.isin, currency: i.currency }))}
      />
    </>
  );
}
