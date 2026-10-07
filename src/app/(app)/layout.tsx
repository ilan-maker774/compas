import Link from "next/link";
import { Nav } from "@/components/nav";
import { getCurrentUser } from "@/server/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
      <aside className="border-b border-line px-4 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r md:py-6">
        <Link href="/" className="mb-3 flex items-baseline gap-2 md:mb-6">
          <span className="text-lg font-semibold tracking-tight">Compas</span>
          <span className="text-xs text-ink-muted">mieux décider</span>
        </Link>
        <Nav />
        <p className="mt-6 hidden text-xs text-ink-muted md:block">
          {user.name ?? user.email}
          <br />
          Outil d&apos;aide à la décision. Aucune recommandation d&apos;investissement.
        </p>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
