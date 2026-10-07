import { ThesisForm } from "@/components/thesis-form";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/server/current-user";
import { loadInstruments } from "@/server/portfolio";

export const metadata = { title: "Nouvelle thèse" };

export default async function NewThesisPage({ searchParams }: PageProps<"/theses/nouvelle">) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const instruments = await loadInstruments(user.id);
  return (
    <>
      <PageHeader
        title="Nouvelle thèse"
        description="Prenez quelques minutes pour écrire votre raisonnement. Seule la thèse est obligatoire ; tout le reste se complète plus tard."
      />
      <ThesisForm
        instruments={instruments
          .filter((i) => i.type !== "indice")
          .map((i) => ({ id: i.id, name: i.name }))}
        defaultInstrumentId={typeof params.instrument === "string" ? params.instrument : ""}
      />
    </>
  );
}
