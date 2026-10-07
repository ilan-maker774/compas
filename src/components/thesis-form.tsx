"use client";

import { createThesis } from "@/server/actions/theses";
import { ActionForm, SubmitButton } from "./action-form";
import { InfoTip } from "./ui";

export function ConvictionField({
  name,
  defaultValue = 3,
}: {
  name: string;
  defaultValue?: number;
}) {
  return (
    <fieldset>
      <legend className="label">
        Niveau de conviction
        <InfoTip>
          1 : simple hypothèse. 5 : conviction très forte, étayée par vos propres analyses.
        </InfoTip>
      </legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              defaultChecked={n === defaultValue}
              className="peer sr-only"
            />
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-sm peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30">
              {n}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ThesisForm({
  instruments,
  defaultInstrumentId,
}: {
  instruments: { id: string; name: string }[];
  defaultInstrumentId: string;
}) {
  return (
    <ActionForm action={createThesis} className="max-w-3xl space-y-5">
      <section className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="instrumentId">
            Titre
          </label>
          <select
            id="instrumentId"
            name="instrumentId"
            className="field"
            defaultValue={defaultInstrumentId}
            required
          >
            <option value="">Choisir…</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="thesisText">
            Thèse : pourquoi j&apos;achète
          </label>
          <textarea id="thesisText" name="thesisText" rows={5} className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="invalidationConditions">
            Conditions d&apos;invalidation : ce qui prouverait que j&apos;ai tort
          </label>
          <textarea
            id="invalidationConditions"
            name="invalidationConditions"
            rows={3}
            className="field"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="horizonMonths">
              Horizon de détention (mois)
            </label>
            <input
              id="horizonMonths"
              name="horizonMonths"
              type="number"
              min={1}
              className="field"
              placeholder="ex. 60"
            />
          </div>
          <div className="sm:col-span-2">
            <ConvictionField name="conviction" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="flex items-center text-sm font-medium">
          Indicateurs clés (jusqu&apos;à 3)
          <InfoTip>
            La condition décrit ce que la thèse attend, par exemple « marge opérationnelle ≥ 15 % ».
            Compas signale quand une valeur renseignée ne la respecte plus.
          </InfoTip>
        </h2>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-12">
            <input
              name={`metric_${i}_name`}
              className="field sm:col-span-4"
              placeholder="Nom (ex. Marge opérationnelle)"
              aria-label={`Indicateur ${i + 1} : nom`}
            />
            <select
              name={`metric_${i}_operator`}
              className="field sm:col-span-2"
              aria-label={`Indicateur ${i + 1} : condition`}
              defaultValue="gte"
            >
              <option value="gt">&gt;</option>
              <option value="gte">≥</option>
              <option value="lt">&lt;</option>
              <option value="lte">≤</option>
            </select>
            <input
              name={`metric_${i}_threshold`}
              inputMode="decimal"
              className="field num sm:col-span-2"
              placeholder="Seuil"
              aria-label={`Indicateur ${i + 1} : seuil`}
            />
            <input
              name={`metric_${i}_unit`}
              className="field sm:col-span-1"
              placeholder="%"
              aria-label={`Indicateur ${i + 1} : unité`}
            />
            <input
              name={`metric_${i}_currentValue`}
              inputMode="decimal"
              className="field num sm:col-span-3"
              placeholder="Valeur actuelle"
              aria-label={`Indicateur ${i + 1} : valeur actuelle`}
            />
            <input
              name={`metric_${i}_currentValueSource`}
              className="field sm:col-span-12"
              placeholder="Source de la valeur (ex. rapport annuel 2025, p. 42)"
              aria-label={`Indicateur ${i + 1} : source`}
            />
          </div>
        ))}
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="reviewIntervalMonths">
            Revue programmée tous les… (mois)
          </label>
          <input
            id="reviewIntervalMonths"
            name="reviewIntervalMonths"
            type="number"
            min={1}
            defaultValue={6}
            className="field"
          />
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="reviewOnEarnings" defaultChecked />
          Revoir aussi après chaque publication de résultats
        </label>
      </section>

      <SubmitButton>Enregistrer la thèse</SubmitButton>
    </ActionForm>
  );
}
