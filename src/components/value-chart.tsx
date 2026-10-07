"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type Point = { date: string; value: number; invested: number };

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const monthFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

const SERIES = [
  { key: "value", label: "Valeur du portefeuille", color: "var(--series-1)", dash: undefined },
  { key: "invested", label: "Capital net investi", color: "var(--series-2)", dash: "5 4" },
] as const;

/**
 * Valeur du portefeuille et capital investi, en fin de mois (pas d'intraday, horizon minimal : le mois).
 * Une seule échelle, deux séries de même unité.
 */
export function ValueChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return (
      <p className="p-4 text-sm text-ink-2">
        Pas encore assez d&apos;historique pour tracer une courbe.
      </p>
    );
  }
  return (
    <figure className="p-4">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2" aria-hidden="true">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="18" height="6">
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dash}
              />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => monthFmt.format(parse(d))}
              tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--line-strong)" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => compact.format(v)}
              tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Évolution mensuelle de la valeur du portefeuille et du capital net investi. Le détail
        chiffré figure dans le tableau ci-dessous.
      </figcaption>
      <details className="mt-3 text-xs text-ink-2">
        <summary className="cursor-pointer select-none">Voir les données</summary>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Valeur</th>
              <th className="text-right">Capital investi</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <td>{dayFmt.format(parse(p.date))}</td>
                <td className="num text-right">{eur0.format(p.value)}</td>
                <td className="num text-right">{eur0.format(p.invested)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-ink">{dayFmt.format(parse(String(label)))}</div>
      {SERIES.map((s) => {
        const item = payload.find((p) => p.dataKey === s.key);
        if (!item) return null;
        return (
          <div key={s.key} className="flex items-center justify-between gap-4 text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="num text-ink">{eur0.format(Number(item.value))}</span>
          </div>
        );
      })}
    </div>
  );
}
