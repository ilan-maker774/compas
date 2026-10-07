"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/actions/state";

/** Formulaire relié à une action serveur : affiche l'erreur ou la confirmation renvoyée. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-critical">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="mt-3 text-sm text-good">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  className = "btn",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Enregistrement…" : children}
    </button>
  );
}
