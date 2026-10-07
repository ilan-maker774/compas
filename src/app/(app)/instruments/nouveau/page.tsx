import { InstrumentForm } from "@/components/instrument-form";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/server/current-user";

export const metadata = { title: "Nouvel instrument" };

export default async function NewInstrumentPage() {
  await getCurrentUser();
  return (
    <>
      <PageHeader
        title="Nouvel instrument"
        description="Action, ETF, fonds, obligation ou fonds euros. Les instruments que vous créez vous sont personnels."
      />
      <InstrumentForm />
    </>
  );
}
