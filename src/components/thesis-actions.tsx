"use client";

import { addReview, closeThesis, updateMetricValue } from "@/server/actions/theses";
import { ActionForm, SubmitButton } from "./action-form";
import { ConvictionField } from "./thesis-form";

export function MetricValueForm({ metricId }: { metricId: string }) {
  return (
    <ActionForm action={updateMetricValue} className="flex flex-wrap gap-2">
      <input type="hidden" name="metricId" value={metricId} />
      <input
        name="currentValue"
        inputMode="decimal"
        className="field num w-28"
        placeholder="Nouvelle valeur"
        aria-label="Nouvelle valeur"
        required
      />
      <input
        name="currentValueSource"
        className="field min-w-48 flex-1"
        placeholder="Source"
        aria-label="Source de la valeur"
      />
      <SubmitButton className="btn-ghost">Mettre à jour</SubmitButton>
    </ActionForm>
  );
}

export function ReviewForm({
  thesisId,
  today,
  conviction,
  metrics,
}: {
  thesisId: string;
  today: string;
  conviction: number;
  metrics: { id: string; name: string; unit: string | null }[];
}) {
  return (
    <ActionForm action={addReview} className="space-y-4 p-4">
      <input type="hidden" name="thesisId" value={thesisId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="reviewedOn">
            Date de la revue
          </label>
          <input
            id="reviewedOn"
            name="reviewedOn"
            type="date"
            defaultValue={today}
            max={today}
            className="field"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <ConvictionField name="convictionAfter" defaultValue={conviction} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">
          Constat : la thèse tient-elle toujours ?
        </label>
        <textarea id="notes" name="notes" rows={4} className="field" required />
      </div>
      {metrics.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="label">Nouvelles valeurs d&apos;indicateurs (facultatif)</legend>
          {metrics.map((m) => (
            <div key={m.id} className="grid gap-2 sm:grid-cols-3">
              <span className="self-center text-sm">
                {m.name}
                {m.unit ? ` (${m.unit})` : ""}
              </span>
              <input
                name={`value_${m.id}`}
                inputMode="decimal"
                className="field num"
                placeholder="Valeur"
                aria-label={`${m.name} : valeur`}
              />
              <input
                name={`source_${m.id}`}
                className="field"
                placeholder="Source"
                aria-label={`${m.name} : source`}
              />
            </div>
          ))}
        </fieldset>
      )}
      <SubmitButton>Enregistrer la revue</SubmitButton>
    </ActionForm>
  );
}

export function ClosureForm({ thesisId, today }: { thesisId: string; today: string }) {
  return (
    <ActionForm action={closeThesis} className="space-y-4 p-4">
      <input type="hidden" name="thesisId" value={thesisId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="closedOn">
            Date
          </label>
          <input
            id="closedOn"
            name="closedOn"
            type="date"
            defaultValue={today}
            max={today}
            className="field"
            required
          />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="label">
            La thèse s&apos;est-elle réalisée, indépendamment du gain ou de la perte ?
          </legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {[
              ["oui", "Oui"],
              ["partiellement", "Partiellement"],
              ["non", "Non"],
            ].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="thesisValidated" value={v} required /> {l}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div>
        <label className="label" htmlFor="saleReason">
          Raison de la vente
        </label>
        <textarea id="saleReason" name="saleReason" rows={2} className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="assessment">
          Bilan : qu&apos;est-ce que j&apos;en retiens ?
        </label>
        <textarea id="assessment" name="assessment" rows={4} className="field" required />
      </div>
      <SubmitButton>Clôturer la thèse</SubmitButton>
    </ActionForm>
  );
}
