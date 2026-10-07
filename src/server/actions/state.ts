import { z } from "zod";

export type ActionState = { error?: string; message?: string } | undefined;

/** Premier message d'erreur de validation, lisible par l'utilisateur. */
export function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  return issue?.message ?? "Données invalides";
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
export const decimalString = (label: string) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(/\s/g, "").replace(",", "."))
    .refine((s) => /^-?\d+(\.\d+)?$/.test(s), `${label} : nombre invalide`);
export const optionalDecimal = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((s) => (s ? s.replace(/\s/g, "").replace(",", ".") : null))
    .refine((s) => s === null || /^-?\d+(\.\d+)?$/.test(s), `${label} : nombre invalide`);

export function formObject(formData: FormData) {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string") obj[k] = v;
  return obj;
}
