import { DeleteDataForm, SettingsForm } from "@/components/settings-forms";
import { PageHeader, Section } from "@/components/ui";
import { getCurrentUser } from "@/server/current-user";
import { loadInstruments } from "@/server/portfolio";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const instruments = await loadInstruments(user.id);
  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="grid max-w-4xl gap-6">
        <Section title="Préférences">
          <SettingsForm
            name={user.name ?? ""}
            theme={user.preferences.theme ?? "system"}
            benchmarkInstrumentId={user.benchmarkInstrumentId ?? ""}
            instruments={instruments
              .filter((i) => i.valuationMode === "market")
              .map((i) => ({ id: i.id, name: i.name }))}
          />
        </Section>
        <Section
          title="Exporter mes données"
          info="Vos données vous appartiennent : exportez-les à tout moment, dans des formats ouverts."
        >
          <div className="flex flex-wrap gap-2 p-4">
            <a className="btn-ghost" href="/export?format=json">
              Tout exporter (JSON)
            </a>
            <a className="btn-ghost" href="/export?format=csv&table=transactions">
              Transactions (CSV)
            </a>
            <a className="btn-ghost" href="/export?format=csv&table=theses">
              Thèses (CSV)
            </a>
            <a className="btn-ghost" href="/export?format=csv&table=instruments">
              Instruments (CSV)
            </a>
          </div>
        </Section>
        <Section title="Supprimer mon compte Compas">
          <DeleteDataForm email={user.email} />
        </Section>
      </div>
    </>
  );
}
