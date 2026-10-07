"use client";

import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import {
  guessMapping,
  IMPORT_FIELDS,
  parseRow,
  type ColumnMapping,
  type ImportField,
} from "@/lib/csv-import";
import { formatDate } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { importTransactions, lastMapping, type ImportResult } from "@/server/actions/import";

type Props = { accounts: { id: string; name: string }[] };

export function ImportWizard({ accounts }: Props) {
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultCurrency, setDefaultCurrency] = useState("EUR");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(
    () => rows.map((r) => parseRow(r, mapping, defaultCurrency)),
    [rows, mapping, defaultCurrency],
  );
  const validCount = parsed.filter((p) => p.ok).length;

  function onFile(file: File) {
    setResult(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: async (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean);
        setHeaders(hs);
        setRows(res.data);
        const previous = await lastMapping(accountId);
        const usable = previous && Object.values(previous).every((col) => hs.includes(col));
        setMapping(usable ? (previous as ColumnMapping) : guessMapping(hs));
      },
    });
  }

  function submit() {
    startTransition(async () => {
      setResult(await importTransactions({ accountId, fileName, mapping, defaultCurrency, rows }));
    });
  }

  return (
    <div className="space-y-6">
      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="account">
            1. Compte de destination
          </label>
          <select
            id="account"
            className="field"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="file">
            2. Fichier CSV (séparateur « ; » ou « , »)
          </label>
          <input
            id="file"
            type="file"
            accept=".csv,text/csv"
            className="field file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-sm"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>
      </section>

      {headers.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-medium">3. Correspondance des colonnes</h2>
          <p className="mb-4 text-xs text-ink-2">
            Pré-remplie d&apos;après les en-têtes (ou votre dernier import sur ce compte). Seule la
            date est obligatoire ; sans colonne « Type », le signe de la quantité indique achat ou
            vente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={`map-${f.key}`}>
                  {f.label}
                  {f.required ? " *" : ""}
                </label>
                <select
                  id={`map-${f.key}`}
                  className="field"
                  value={mapping[f.key as ImportField] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label className="label" htmlFor="currency">
                Devise par défaut
              </label>
              <input
                id="currency"
                className="field uppercase"
                maxLength={3}
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-sm font-medium">
              4. Aperçu : {validCount} ligne(s) valide(s) sur {rows.length}
            </h2>
            <button
              className="btn"
              onClick={submit}
              disabled={pending || validCount === 0 || !mapping.date}
            >
              {pending ? "Import en cours…" : `Importer ${validCount} opération(s)`}
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="table">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th>Ligne</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Titre</th>
                  <th className="text-right">Qté</th>
                  <th className="text-right">Prix / montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 200).map((p, i) => (
                  <tr key={i}>
                    <td className="num text-ink-muted">{i + 2}</td>
                    {p.ok ? (
                      <>
                        <td className="num">{formatDate(p.row.tradeDate)}</td>
                        <td>{TRANSACTION_TYPE_LABELS[p.row.type]}</td>
                        <td className="max-w-56 truncate">
                          {p.row.name ?? p.row.isin ?? p.row.ticker ?? "—"}
                        </td>
                        <td className="num text-right">{p.row.quantity ?? ""}</td>
                        <td className="num text-right">
                          {p.row.unitPrice ?? p.row.amount} {p.row.currency}
                        </td>
                        <td className="text-good">OK</td>
                      </>
                    ) : (
                      <td colSpan={6} className="text-critical">
                        {p.errors.join(" · ")}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && (
        <section role="status" className="card space-y-1 p-5 text-sm">
          {result.error ? (
            <p className="text-critical">{result.error}</p>
          ) : (
            <>
              <p>
                <strong>{result.imported}</strong> opération(s) importée(s), {result.duplicates}{" "}
                déjà présente(s) ignorée(s), {result.rejected?.length ?? 0} ligne(s) rejetée(s).
              </p>
              {result.createdInstruments && result.createdInstruments.length > 0 && (
                <p className="text-ink-2">
                  Titres créés : {result.createdInstruments.join(", ")}. Complétez leur classe
                  d&apos;actifs et leur zone dans Instruments pour une répartition exacte.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
