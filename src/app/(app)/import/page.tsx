import { ImportWizard } from "@/components/import-wizard";
import { PageHeader, TextLink } from "@/components/ui";
import { getCurrentUser } from "@/server/current-user";
import { loadAccounts } from "@/server/portfolio";

export const metadata = { title: "Import CSV" };

export default async function ImportPage() {
  const user = await getCurrentUser();
  const accounts = await loadAccounts(user.id);
  return (
    <>
      <PageHeader
        title="Import CSV"
        description={
          <>
            Exportez l&apos;historique de vos opérations depuis votre courtier ou votre assureur,
            puis associez ses colonnes à celles de Compas. Les lignes déjà importées sont ignorées :
            vous pouvez réimporter un fichier sans créer de doublons.{" "}
            <TextLink href="/import/modele">Télécharger un modèle</TextLink>.
          </>
        }
      />
      {accounts.length === 0 ? (
        <p className="text-sm text-ink-2">
          Créez d&apos;abord un <TextLink href="/comptes">compte</TextLink> dans lequel importer.
        </p>
      ) : (
        <ImportWizard accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
      )}
    </>
  );
}
