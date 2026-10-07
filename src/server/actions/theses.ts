"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { theses, thesisClosures, thesisMetrics, thesisReviews } from "@/db/schema";
import { today } from "@/lib/dates";
import { MAX_METRICS_PER_THESIS, nextReviewDate } from "@/lib/theses";
import { getCurrentUser } from "../current-user";
import { db } from "../db";
import {
  type ActionState,
  decimalString,
  firstIssue,
  formObject,
  isoDate,
  optionalDecimal,
} from "./state";

const conviction = z.coerce
  .number()
  .int()
  .min(1, "Conviction entre 1 et 5")
  .max(5, "Conviction entre 1 et 5");
const optionalInt = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .refine(
    (v) => v === null || (Number.isInteger(v) && v > 0 && v < 1000),
    "Nombre de mois invalide",
  );

const thesisSchema = z.object({
  instrumentId: z.string().uuid("Choisissez un titre"),
  thesisText: z.string().trim().min(1, "Décrivez la thèse").max(5000),
  invalidationConditions: z.string().trim().max(3000).optional(),
  horizonMonths: optionalInt,
  conviction,
  reviewIntervalMonths: optionalInt,
  reviewOnEarnings: z.string().optional(),
});

function parseMetrics(obj: Record<string, string>) {
  const metrics = [];
  for (let i = 0; i < MAX_METRICS_PER_THESIS; i++) {
    const name = obj[`metric_${i}_name`]?.trim();
    if (!name) continue;
    const parsed = z
      .object({
        name: z.string().max(120),
        operator: z.enum(["gt", "gte", "lt", "lte"]),
        threshold: decimalString(`Seuil de « ${name} »`),
        unit: z.string().max(10).optional(),
        currentValue: optionalDecimal(`Valeur de « ${name} »`),
        currentValueSource: z.string().max(200).optional(),
      })
      .safeParse({
        name,
        operator: obj[`metric_${i}_operator`],
        threshold: obj[`metric_${i}_threshold`] ?? "",
        unit: obj[`metric_${i}_unit`],
        currentValue: obj[`metric_${i}_currentValue`],
        currentValueSource: obj[`metric_${i}_currentValueSource`],
      });
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    metrics.push({ ...parsed.data, position: i });
  }
  return { metrics };
}

export async function createThesis(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const obj = formObject(formData);
  const parsed = thesisSchema.safeParse(obj);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const m = parseMetrics(obj);
  if ("error" in m) return { error: m.error };
  const d = parsed.data;
  const created = today();

  const id = await db.transaction(async (tx) => {
    const [thesis] = await tx
      .insert(theses)
      .values({
        userId: user.id,
        instrumentId: d.instrumentId,
        thesisText: d.thesisText,
        invalidationConditions: d.invalidationConditions || null,
        horizonMonths: d.horizonMonths,
        conviction: d.conviction,
        reviewIntervalMonths: d.reviewIntervalMonths,
        reviewOnEarnings: d.reviewOnEarnings === "on",
        nextReviewOn: nextReviewDate({
          lastReviewOn: created,
          intervalMonths: d.reviewIntervalMonths,
        }),
      })
      .returning();
    if (m.metrics.length) {
      await tx.insert(thesisMetrics).values(
        m.metrics.map((x) => ({
          thesisId: thesis.id,
          name: x.name,
          operator: x.operator,
          threshold: x.threshold,
          unit: x.unit || null,
          currentValue: x.currentValue,
          currentValueAsOf: x.currentValue ? created : null,
          currentValueSource: x.currentValueSource || (x.currentValue ? "saisie manuelle" : null),
          position: x.position,
        })),
      );
    }
    return thesis.id;
  });
  revalidatePath("/", "layout");
  redirect(`/theses/${id}`);
}

async function ownedThesis(userId: string, id: string) {
  const [t] = await db
    .select()
    .from(theses)
    .where(and(eq(theses.id, id), eq(theses.userId, userId)));
  return t;
}

const reviewSchema = z.object({
  thesisId: z.string().uuid(),
  reviewedOn: isoDate,
  notes: z.string().trim().min(1, "Notez ce que vous avez relu et constaté").max(5000),
  convictionAfter: conviction,
});

export async function addReview(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const obj = formObject(formData);
  const parsed = reviewSchema.safeParse(obj);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const thesis = await ownedThesis(user.id, parsed.data.thesisId);
  if (!thesis || thesis.status !== "active") return { error: "Thèse introuvable ou clôturée." };

  // Mise à jour facultative des valeurs d'indicateurs au moment de la revue.
  const metrics = await db
    .select()
    .from(thesisMetrics)
    .where(eq(thesisMetrics.thesisId, thesis.id));
  const updates: { id: string; value: string; source: string | null }[] = [];
  for (const metric of metrics) {
    const raw = obj[`value_${metric.id}`]?.trim();
    if (!raw) continue;
    const v = optionalDecimal(metric.name).safeParse(raw);
    if (!v.success) return { error: firstIssue(v.error) };
    updates.push({
      id: metric.id,
      value: v.data!,
      source: obj[`source_${metric.id}`]?.trim() || null,
    });
  }

  await db.transaction(async (tx) => {
    await tx.insert(thesisReviews).values({
      thesisId: thesis.id,
      reviewedOn: parsed.data.reviewedOn,
      notes: parsed.data.notes,
      convictionAfter: parsed.data.convictionAfter,
    });
    for (const u of updates) {
      await tx
        .update(thesisMetrics)
        .set({
          currentValue: u.value,
          currentValueAsOf: parsed.data.reviewedOn,
          currentValueSource: u.source ?? "saisie manuelle",
        })
        .where(eq(thesisMetrics.id, u.id));
    }
    await tx
      .update(theses)
      .set({
        conviction: parsed.data.convictionAfter,
        nextReviewOn: nextReviewDate({
          lastReviewOn: parsed.data.reviewedOn,
          intervalMonths: thesis.reviewIntervalMonths,
        }),
      })
      .where(eq(theses.id, thesis.id));
  });
  revalidatePath("/", "layout");
  return { message: "Revue enregistrée." };
}

const metricValueSchema = z.object({
  metricId: z.string().uuid(),
  currentValue: decimalString("Valeur"),
  currentValueSource: z.string().trim().max(200).optional(),
});

export async function updateMetricValue(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = metricValueSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const [row] = await db
    .select({ metric: thesisMetrics, thesis: theses })
    .from(thesisMetrics)
    .innerJoin(theses, eq(thesisMetrics.thesisId, theses.id))
    .where(and(eq(thesisMetrics.id, parsed.data.metricId), eq(theses.userId, user.id)));
  if (!row) return { error: "Indicateur introuvable." };
  await db
    .update(thesisMetrics)
    .set({
      currentValue: parsed.data.currentValue,
      currentValueAsOf: today(),
      currentValueSource: parsed.data.currentValueSource || "saisie manuelle",
    })
    .where(eq(thesisMetrics.id, row.metric.id));
  revalidatePath("/", "layout");
  return { message: "Valeur mise à jour." };
}

const closureSchema = z.object({
  thesisId: z.string().uuid(),
  closedOn: isoDate,
  saleReason: z.string().trim().min(1, "Indiquez la raison de la vente").max(3000),
  thesisValidated: z.enum(["oui", "non", "partiellement"], {
    message: "La thèse s'est-elle réalisée ?",
  }),
  assessment: z.string().trim().min(1, "Rédigez un bilan, même court").max(5000),
});

export async function closeThesis(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = closureSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const thesis = await ownedThesis(user.id, parsed.data.thesisId);
  if (!thesis || thesis.status !== "active")
    return { error: "Thèse introuvable ou déjà clôturée." };
  await db.transaction(async (tx) => {
    await tx.insert(thesisClosures).values(parsed.data);
    await tx
      .update(theses)
      .set({ status: "cloturee", nextReviewOn: null })
      .where(eq(theses.id, thesis.id));
  });
  revalidatePath("/", "layout");
  redirect(`/theses/${thesis.id}`);
}
