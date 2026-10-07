"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/portefeuille", label: "Portefeuille" },
  { href: "/transactions", label: "Transactions" },
  { href: "/import", label: "Import CSV" },
  { href: "/theses", label: "Journal de thèse" },
  { href: "/instruments", label: "Instruments" },
  { href: "/comptes", label: "Comptes" },
  { href: "/parametres", label: "Paramètres" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav
      aria-label="Navigation principale"
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
    >
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(l.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${
            isActive(l.href)
              ? "bg-surface-2 font-medium text-ink"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
