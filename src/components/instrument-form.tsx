"use client";

import { ASSET_CLASS_LABELS, INSTRUMENT_TYPE_LABELS, REGION_LABELS } from "@/lib/labels";
import { addManualPrice, createInstrument, updateInstrument } from "@/server/actions/instruments";
import { ActionForm, SubmitButton } from "./action-form";

type Instrument = {
  id: string;
  name: string;
  isin: string | null;
  ticker: string | null;
  type: string;
  assetClass: string;
  currency: string;
  country: string | null;
  region: string | null;
  sector: string | null;
  providerRefs: Record<string, string>;
};

const regions = Object.entries(REGION_LABELS).filter(
  ([k]) => !["non_renseigne", "liquidites"].includes(k),
);
const classes = Object.entries(ASSET_CLASS_LABELS).filter(([k]) => k !== "liquidites");

export function InstrumentForm({ instrument }: { instrument?: Instrument }) {
  return (
    <ActionForm
      action={instrument ? updateInstrument : createInstrument}
      className="card max-w-2xl space-y-4 p-5"
    >
      {instrument && <input type="hidden" name="id" value={instrument.id} />}
      <div>
        <label className="label" htmlFor="name">
          Nom
        </label>
        <input id="name" name="name" className="field" defaultValue={instrument?.name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="isin">
            ISIN
          </label>
          <input
            id="isin"
            name="isin"
            className="field uppercase"
            maxLength={12}
            defaultValue={instrument?.isin ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="ticker">
            Ticker
          </label>
          <input
            id="ticker"
            name="ticker"
            className="field"
            defaultValue={instrument?.ticker ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="currency">
            Devise de cotation
          </label>
          <input
            id="currency"
            name="currency"
            className="field uppercase"
            maxLength={3}
            defaultValue={instrument?.currency ?? "EUR"}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            className="field"
            defaultValue={instrument?.type ?? "action"}
          >
            {Object.entries(INSTRUMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="assetClass">
            Classe d&apos;actifs
          </label>
          <select
            id="assetClass"
            name="assetClass"
            className="field"
            defaultValue={instrument?.assetClass ?? "actions"}
          >
            {classes.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="region">
            Zone géographique
          </label>
          <select
            id="region"
            name="region"
            className="field"
            defaultValue={instrument?.region ?? ""}
          >
            <option value="">Non renseignée</option>
            {regions.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="country">
            Pays (FR, US…)
          </label>
          <input
            id="country"
            name="country"
            className="field uppercase"
            maxLength={2}
            defaultValue={instrument?.country ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="sector">
            Secteur
          </label>
          <input
            id="sector"
            name="sector"
            className="field"
            defaultValue={instrument?.sector ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="providerRef">
            Code fournisseur (EODHD)
          </label>
          <input
            id="providerRef"
            name="providerRef"
            className="field"
            placeholder="ex. CW8.PA"
            defaultValue={instrument?.providerRefs.eodhd ?? ""}
          />
        </div>
      </div>
      <SubmitButton>{instrument ? "Enregistrer" : "Créer l'instrument"}</SubmitButton>
    </ActionForm>
  );
}

export function ManualPriceForm({ instrumentId, today }: { instrumentId: string; today: string }) {
  return (
    <ActionForm
      action={addManualPrice}
      className="flex flex-wrap items-end gap-2 border-b border-line p-4"
    >
      <input type="hidden" name="id" value={instrumentId} />
      <div>
        <label className="label" htmlFor="price-date">
          Date
        </label>
        <input
          id="price-date"
          name="date"
          type="date"
          defaultValue={today}
          max={today}
          className="field"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="price-close">
          Cours de clôture
        </label>
        <input
          id="price-close"
          name="close"
          inputMode="decimal"
          className="field num w-32"
          required
        />
      </div>
      <SubmitButton className="btn-ghost">Ajouter</SubmitButton>
    </ActionForm>
  );
}
