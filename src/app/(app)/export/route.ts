import { eq, inArray } from "drizzle-orm";
import Papa from "papaparse";
import {
  importBatches,
  investmentAccounts,
  theses,
  thesisClosures,
  thesisMetrics,
  thesisReviews,
  transactions,
} from "@/db/schema";
import { today } from "@/lib/dates";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/server/db";
import { loadInstruments } from "@/server/portfolio";

/** Export complet des données de l'utilisateur (portabilité RGPD). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  const accounts = await db
    .select()
    .from(investmentAccounts)
    .where(eq(investmentAccounts.userId, user.id));
  const accountIds = accounts.map((a) => a.id);
  const txs = accountIds.length
    ? await db.select().from(transactions).where(inArray(transactions.accountId, accountIds))
    : [];
  const batches = accountIds.length
    ? await db.select().from(importBatches).where(inArray(importBatches.accountId, accountIds))
    : [];
  const userTheses = await db.select().from(theses).where(eq(theses.userId, user.id));
  const thesisIds = userTheses.map((t) => t.id);
  const [metrics, reviews, closures] = thesisIds.length
    ? await Promise.all([
        db.select().from(thesisMetrics).where(inArray(thesisMetrics.thesisId, thesisIds)),
        db.select().from(thesisReviews).where(inArray(thesisReviews.thesisId, thesisIds)),
        db.select().from(thesisClosures).where(inArray(thesisClosures.thesisId, thesisIds)),
      ])
    : [[], [], []];
  const usedInstrumentIds = new Set([
    ...txs.map((t) => t.instrumentId),
    ...userTheses.map((t) => t.instrumentId),
  ]);
  const insts = (await loadInstruments(user.id)).filter(
    (i) => usedInstrumentIds.has(i.id) || i.ownerUserId === user.id,
  );

  const stamp = today();
  if (format === "json") {
    const body = {
      exportedAt: new Date().toISOString(),
      user: {
        email: user.email,
        name: user.name,
        referenceCurrency: user.referenceCurrency,
        preferences: user.preferences,
      },
      accounts,
      instruments: insts,
      transactions: txs,
      importBatches: batches,
      theses: userTheses,
      thesisMetrics: metrics,
      thesisReviews: reviews,
      thesisClosures: closures,
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="compas-export-${stamp}.json"`,
      },
    });
  }

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const instrument = new Map(insts.map((i) => [i.id, i]));
  const table = url.searchParams.get("table");
  let rows: Record<string, unknown>[];
  if (table === "theses") {
    rows = userTheses.map((t) => ({
      titre: instrument.get(t.instrumentId)?.name,
      statut: t.status,
      these: t.thesisText,
      invalidation: t.invalidationConditions,
      horizon_mois: t.horizonMonths,
      conviction: t.conviction,
      prochaine_revue: t.nextReviewOn,
      creee_le: t.createdAt.toISOString().slice(0, 10),
      raison_vente: closures.find((c) => c.thesisId === t.id)?.saleReason,
      these_validee: closures.find((c) => c.thesisId === t.id)?.thesisValidated,
      bilan: closures.find((c) => c.thesisId === t.id)?.assessment,
    }));
  } else if (table === "instruments") {
    rows = insts.map((i) => ({
      nom: i.name,
      isin: i.isin,
      ticker: i.ticker,
      type: i.type,
      classe: i.assetClass,
      devise: i.currency,
      pays: i.country,
      zone: i.region,
      secteur: i.sector,
      codes_fournisseurs: JSON.stringify(i.providerRefs),
    }));
  } else {
    rows = txs.map((t) => ({
      date: t.tradeDate,
      compte: accountName.get(t.accountId),
      type: t.type,
      isin: t.instrumentId ? instrument.get(t.instrumentId)?.isin : "",
      titre: t.instrumentId ? instrument.get(t.instrumentId)?.name : "",
      quantite: t.quantity,
      prix: t.unitPrice,
      montant: t.amount,
      frais: t.fees,
      taxes: t.taxes,
      devise: t.currency,
      taux_change: t.fxRateToEur,
      note: t.notes,
    }));
  }
  // Nombres sans zéros de remplissage (« 15000.00000000 » → « 15000 »).
  const tidy = rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        typeof v === "string" && /^-?\d+\.\d+$/.test(v) ? v.replace(/\.?0+$/, "") : v,
      ]),
    ),
  );
  const csv = Papa.unparse(tidy, { delimiter: ";" });
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compas-${table ?? "transactions"}-${stamp}.csv"`,
    },
  });
}
