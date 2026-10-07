import { WelcomeForm } from "@/components/welcome-form";

export const metadata = { title: "Bienvenue" };

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compas</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Un outil pour mieux décider, pas pour décider plus souvent. Compas suit votre patrimoine,
          calcule vos performances et tient le journal de vos décisions. Il n&apos;achète ni ne vend
          rien, et ne vous dira jamais quoi faire.
        </p>
      </div>
      <WelcomeForm />
    </main>
  );
}
