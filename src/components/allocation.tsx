import { formatEur, formatPct } from "@/lib/format";

type Slice = { key: string; label: string; valueEur: { toNumber(): number }; weight: number };

/** Répartition en barres horizontales (une seule teinte : seule la grandeur compte). */
export function AllocationBars({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) return <p className="p-4 text-sm text-ink-2">Aucune position.</p>;
  const max = Math.max(...slices.map((s) => Math.abs(s.weight)));
  return (
    <ul className="space-y-2.5 p-4">
      {slices.map((s) => (
        <li key={s.key} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-ink">{s.label}</span>
            <span className="num shrink-0 text-ink-2">
              {formatEur(s.valueEur.toNumber(), { decimals: false })} ·{" "}
              <span className="text-ink">{formatPct(s.weight, { digits: 1 })}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2" aria-hidden="true">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${max > 0 ? (Math.max(s.weight, 0) / max) * 100 : 0}%`,
                background: "var(--series-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
