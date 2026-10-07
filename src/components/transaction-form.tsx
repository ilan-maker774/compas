"use client";

import Link from "next/link";
import { useState } from "react";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { createTransaction } from "@/server/actions/transactions";
import { ActionForm, SubmitButton } from "./action-form";

type Props = {
  today: string;
  accounts: { id: string; name: string }[];
  instruments: { id: string; name: string; isin: string | null; currency: string }[];
};

export function TransactionForm({ today, accounts, instruments }: Props) {
  const [type, setType] = useState("achat");
  const [instrumentId, setInstrumentId] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const isTrade = type === "achat" || type === "vente";
  const needsInstrument = isTrade || type === "dividende" || type === "interets";

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-ink-2">
        Créez d&apos;abord un compte dans{" "}
        <Link className="text-accent-ink underline" href="/comptes">
          Comptes
        </Link>
        .
      </p>
    );
  }

  return (
    <ActionForm action={createTransaction} className="card max-w-2xl space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="accountId">
            Compte
          </label>
          <select id="accountId" name="accountId" className="field" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            className="field"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tradeDate">
            Date
          </label>
          <input
            id="tradeDate"
            name="tradeDate"
            type="date"
            className="field"
            defaultValue={today}
            max={today}
            required
          />
        </div>
      </div>

      {needsInstrument && (
        <div>
          <label className="label" htmlFor="instrumentId">
            Titre
          </label>
          <select
            id="instrumentId"
            name="instrumentId"
            className="field"
            value={instrumentId}
            onChange={(e) => {
              setInstrumentId(e.target.value);
              const inst = instruments.find((i) => i.id === e.target.value);
              if (inst) setCurrency(inst.currency);
            }}
            required
          >
            <option value="">Choisir…</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.isin ? ` (${i.isin})` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            Titre absent ?{" "}
            <Link className="underline" href="/instruments/nouveau">
              Ajoutez-le
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {isTrade ? (
          <>
            <div>
              <label className="label" htmlFor="quantity">
                Quantité
              </label>
              <input
                id="quantity"
                name="quantity"
                inputMode="decimal"
                className="field num"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="unitPrice">
                Prix unitaire
              </label>
              <input
                id="unitPrice"
                name="unitPrice"
                inputMode="decimal"
                className="field num"
                required
              />
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor="amount">
              {type === "dividende" || type === "interets" ? "Montant brut" : "Montant"}
            </label>
            <input id="amount" name="amount" inputMode="decimal" className="field num" required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="currency">
            Devise
          </label>
          <input
            id="currency"
            name="currency"
            className="field uppercase"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="fees">
            Frais
          </label>
          <input id="fees" name="fees" inputMode="decimal" className="field num" placeholder="0" />
        </div>
        <div>
          <label className="label" htmlFor="taxes">
            {type === "dividende" ? "Retenue à la source" : "Taxes (TTF…)"}
          </label>
          <input
            id="taxes"
            name="taxes"
            inputMode="decimal"
            className="field num"
            placeholder="0"
          />
        </div>
        {currency !== "EUR" && (
          <div>
            <label className="label" htmlFor="fxRateToEur">
              Taux appliqué (1 € = x {currency})
            </label>
            <input
              id="fxRateToEur"
              name="fxRateToEur"
              inputMode="decimal"
              className="field num"
              placeholder="taux BCE si vide"
            />
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="notes">
          Note (facultatif)
        </label>
        <input id="notes" name="notes" className="field" maxLength={500} />
      </div>
      <SubmitButton>Enregistrer</SubmitButton>
    </ActionForm>
  );
}
