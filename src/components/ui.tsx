import type Decimal from "decimal.js";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Infobulle explicative : chaque indicateur affiché en a une (principe de la vision).
 * Accessible au clavier (focus) et au survol, sans JavaScript.
 */
export function InfoTip({
  children,
  label = "Explication",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line-strong text-[10px] leading-none text-ink-muted hover:text-ink focus:text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-md border border-line bg-surface p-2.5 text-left text-xs font-normal leading-relaxed text-ink-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  info,
  source,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  info: ReactNode;
  source?: ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center text-xs font-medium text-ink-2">
        {label}
        <InfoTip label={`À propos : ${label}`}>{info}</InfoTip>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-sm text-ink-2">{sub}</div>}
      {source && <div className="mt-2 text-[11px] text-ink-muted">{source}</div>}
    </div>
  );
}

/** Variation signée. Couleurs sobres : le signe et le texte portent l'information, pas la couleur seule. */
export function Signed({
  value,
  children,
}: {
  value: number | Decimal | null;
  children: ReactNode;
}) {
  const n = value === null ? 0 : typeof value === "number" ? value : value.toNumber();
  const cls = n > 0 ? "text-good" : n < 0 ? "text-critical" : "text-ink-2";
  return <span className={`num ${cls}`}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-6">
      <h2 className="font-medium">{title}</h2>
      {children && <div className="text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "critical" | "good";
}) {
  const tones = {
    neutral: "border-line-strong text-ink-2",
    accent: "border-accent/40 text-accent-ink",
    warning: "border-warning-ink/40 bg-warning-bg text-warning-ink",
    critical: "border-critical/40 text-critical",
    good: "border-good/40 text-good",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  info,
  actions,
  children,
}: {
  title: string;
  info?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="flex items-center text-sm font-medium">
          {title}
          {info && <InfoTip label={`À propos : ${title}`}>{info}</InfoTip>}
        </h2>
        {actions}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-accent-ink underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning";
  children: ReactNode;
}) {
  const cls =
    tone === "warning"
      ? "border-warning-ink/30 bg-warning-bg text-warning-ink"
      : "border-line bg-surface-2 text-ink-2";
  return <div className={`rounded-md border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
