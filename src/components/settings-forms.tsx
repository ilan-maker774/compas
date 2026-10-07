"use client";

import { deleteMyData, updateSettings } from "@/server/actions/settings";
import { ActionForm, SubmitButton } from "./action-form";

export function SettingsForm(props: {
  name: string;
  theme: string;
  benchmarkInstrumentId: string;
  instruments: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={updateSettings} className="grid gap-4 p-4 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="name">
          Prénom ou pseudonyme
        </label>
        <input id="name" name="name" className="field" defaultValue={props.name} />
      </div>
      <div>
        <label className="label" htmlFor="theme">
          Apparence
        </label>
        <select id="theme" name="theme" className="field" defaultValue={props.theme}>
          <option value="system">Selon le système</option>
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="benchmark">
          Indice de référence
        </label>
        <select
          id="benchmark"
          name="benchmarkInstrumentId"
          className="field"
          defaultValue={props.benchmarkInstrumentId}
        >
          <option value="">Aucun</option>
          {props.instruments.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-3">
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteDataForm({ email }: { email: string }) {
  return (
    <ActionForm action={deleteMyData} className="space-y-3 p-4">
      <p className="text-sm text-ink-2">
        Supprime définitivement votre profil, vos comptes, opérations, instruments personnels et
        thèses. Pensez à exporter vos données avant. Cette action est irréversible.
      </p>
      <div className="max-w-sm">
        <label className="label" htmlFor="confirm">
          Pour confirmer, saisissez {email}
        </label>
        <input id="confirm" name="confirm" className="field" autoComplete="off" required />
      </div>
      <SubmitButton className="btn-danger">Supprimer définitivement</SubmitButton>
    </ActionForm>
  );
}
