"use client";

import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { createAccount } from "@/server/actions/accounts";
import { ActionForm, SubmitButton } from "./action-form";

export function AccountForm() {
  return (
    <ActionForm action={createAccount} className="space-y-3 p-4">
      <div>
        <label className="label" htmlFor="acc-name">
          Nom
        </label>
        <input
          id="acc-name"
          name="name"
          className="field"
          placeholder="ex. PEA Boursorama"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="acc-type">
          Type
        </label>
        <select id="acc-type" name="type" className="field">
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="acc-inst">
          Établissement
        </label>
        <input id="acc-inst" name="institution" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="acc-opened">
          Date d&apos;ouverture
        </label>
        <input id="acc-opened" name="openedOn" type="date" className="field" />
      </div>
      <SubmitButton>Créer le compte</SubmitButton>
    </ActionForm>
  );
}
