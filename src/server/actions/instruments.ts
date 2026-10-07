"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { instruments, prices } from "@/db/schema";
import { getCurrentUser } from "../current-user";
import { db } from "../db";
import { type ActionState, decimalString, firstIssue, formObject, isoDate } from "./state";

const fields = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  isin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v), "ISIN invalide (12 caractères)"),
  ticker: z.string().trim().max(20).optional(),
  type: z.enum(["action", "etf", "fonds", "obligation", "fonds_euros", "indice", "autre"]),
  assetClass: z.enum([
    "actions",
    "obligations",
    "monetaire",
    "fonds_euros",
    "immobilier",
    "matieres_premieres",
    "mixte",
    "autre",
  ]),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Devise invalide"),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || /^[A-Z]{2}$/.test(v), "Pays : code à 2 lettres (FR, US…)"),
  region: z
    .enum([
      "",
      "monde",
      "france",
      "europe",
      "amerique_du_nord",
      "japon",
      "asie_pacifique",
      "emergents",
      "autre",
    ])
    .optional(),
  sector: z.string().trim().max(80).optional(),
  providerRef: z.string().trim().max(40).optional(),
});

function toValues(d: z.infer<typeof fields>) {
  return {
    name: d.name,
    isin: d.isin || null,
    ticker: d.ticker || null,
    type: d.type,
    assetClass: d.type === "fonds_euros" ? ("fonds_euros" as const) : d.assetClass,
    currency: d.currency,
    country: d.country || null,
    region: d.region || null,
    sector: d.sector || null,
    valuationMode: d.type === "fonds_euros" ? ("nominal" as const) : ("market" as const),
    providerRefs: (d.providerRef ? { eodhd: d.providerRef } : {}) as Record<string, string>,
  };
}

/** Les instruments créés par l'utilisateur lui sont privés : les données de référence partagées restent intactes. */
export async function createInstrument(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = fields.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const [created] = await db
    .insert(instruments)
    .values({ ...toValues(parsed.data), ownerUserId: user.id })
    .returning();
  revalidatePath("/instruments");
  redirect(`/instruments/${created.id}`);
}

export async function updateInstrument(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const id = String(formData.get("id"));
  const parsed = fields.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const updated = await db
    .update(instruments)
    .set(toValues(parsed.data))
    .where(and(eq(instruments.id, id), eq(instruments.ownerUserId, user.id)))
    .returning();
  if (updated.length === 0) return { error: "Seuls vos instruments personnels sont modifiables." };
  revalidatePath("/", "layout");
  return { message: "Instrument mis à jour." };
}

const priceSchema = z.object({
  id: z.string().uuid(),
  date: isoDate,
  close: decimalString("Cours"),
});

export async function addManualPrice(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = priceSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const [inst] = await db
    .select()
    .from(instruments)
    .where(and(eq(instruments.id, parsed.data.id), eq(instruments.ownerUserId, user.id)));
  if (!inst)
    return { error: "Les cours des instruments partagés viennent du fournisseur de données." };
  if (Number(parsed.data.close) <= 0) return { error: "Le cours doit être positif." };
  await db
    .insert(prices)
    .values({
      instrumentId: inst.id,
      date: parsed.data.date,
      close: parsed.data.close,
      source: "saisie manuelle",
    })
    .onConflictDoUpdate({
      target: [prices.instrumentId, prices.date],
      set: { close: parsed.data.close, source: "saisie manuelle" },
    });
  revalidatePath("/", "layout");
  return { message: "Cours enregistré." };
}
