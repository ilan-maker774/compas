import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { instruments, theses, thesisClosures, thesisMetrics, thesisReviews } from "@/db/schema";
import { evaluateMetric, type Operator } from "@/lib/theses";
import { db } from "./db";

export async function loadTheses(userId: string, opts: { status?: "active" | "cloturee" } = {}) {
  const rows = await db
    .select({ thesis: theses, instrument: instruments })
    .from(theses)
    .innerJoin(instruments, eq(theses.instrumentId, instruments.id))
    .where(and(eq(theses.userId, userId), opts.status ? eq(theses.status, opts.status) : undefined))
    .orderBy(desc(theses.createdAt));
  const ids = rows.map((r) => r.thesis.id);
  const metrics = ids.length
    ? await db
        .select()
        .from(thesisMetrics)
        .where(inArray(thesisMetrics.thesisId, ids))
        .orderBy(asc(thesisMetrics.position))
    : [];
  const closures = ids.length
    ? await db.select().from(thesisClosures).where(inArray(thesisClosures.thesisId, ids))
    : [];
  return rows.map(({ thesis, instrument }) => {
    const ms = metrics
      .filter((m) => m.thesisId === thesis.id)
      .map((m) => ({
        ...m,
        status: evaluateMetric(m.operator as Operator, m.threshold, m.currentValue),
      }));
    return {
      ...thesis,
      instrument,
      metrics: ms,
      closure: closures.find((c) => c.thesisId === thesis.id) ?? null,
      breached: ms.filter((m) => m.status === "franchi"),
    };
  });
}

export type ThesisWithDetails = Awaited<ReturnType<typeof loadTheses>>[number];

export async function loadThesis(userId: string, id: string) {
  const all = await loadTheses(userId);
  const thesis = all.find((t) => t.id === id);
  if (!thesis) return null;
  const reviews = await db
    .select()
    .from(thesisReviews)
    .where(eq(thesisReviews.thesisId, id))
    .orderBy(desc(thesisReviews.reviewedOn));
  return { ...thesis, reviews };
}
