"use client";

import { createProfile } from "@/server/actions/welcome";
import { ActionForm, SubmitButton } from "./action-form";

export function WelcomeForm() {
  return (
    <ActionForm action={createProfile} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="email">
          Adresse e-mail
        </label>
        <input id="email" name="email" type="email" className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="name">
          Prénom ou pseudonyme (facultatif)
        </label>
        <input id="name" name="name" className="field" />
      </div>
      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input type="checkbox" name="demo" className="mt-0.5" />
        Charger un portefeuille de démonstration (cours simulés) pour découvrir l&apos;outil
      </label>
      <SubmitButton>Commencer</SubmitButton>
    </ActionForm>
  );
}
