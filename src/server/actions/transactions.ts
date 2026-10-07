"use server";

import Decimal from "decimal.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { instruments, investmentAccounts, theses, transactions } from "@/db/schema";
import { getCurrentUser } from "../current-user";
import { db } from "../db";
import { type ActionState, firstIssue, formObject, isoDate, optionalDecimal } from "./state";

const base = z.object({
  accountId: z.string().uuid("Compte requis"),
  type: z.enum([
    "achat",
    "vente",
    "dividende",
    "interets",
    "frais",
    "taxe",
    "versement",
    "retrait",
  ]),
  tradeDate: isoDate,
  instrumentId: z.string().optional(),
  quantity: optionalDecimal("Quantité"),
  unitPrice: optionalDecimal("Prix"),
  amount: optionalDecimal("Montant"),
  fees: optionalDecimal("Frais"),
  taxes: optionalDecimal("Taxes"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Devise invalide"),
  fxRateToEur: optionalDecimal("Taux de change"),
  notes: z.string().max(500).optional(),
});

async function ownedAccount(userId: string, accountId: string) {
  const [acc] = await db
    .select()
    .from(investmentAccounts)
    .where(and(eq(investmentAccounts.id, accountId), eq(investmentAccounts.userId, userId)));
  return acc;
}

/** Quantité détenue d'un instrument, tous comptes de l'utilisateur confondus. */
async function heldQuantity(accountIds: string[], instrumentId: string) {
  if (accountIds.length === 0) return new Decimal(0);
  const [row] = await db
    .select({
      q: sql<string>`coalesce(sum(case when ${transactions.type} = 'achat' then ${transactions.quantity}
        when ${transactions.type} = 'vente' then -${transactions.quantity}
        when ${transactions.type} = 'interets' then coalesce(${transactions.quantity}, 0) else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(inArray(transactions.accountId, accountIds), eq(transactions.instrumentId, instrumentId)),
    );
  return new Decimal(row.q);
}

export async function createTransaction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = base.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;
  if (!(await ownedAccount(user.id, d.accountId))) return { error: "Compte introuvable" };

  const needsInstrument = ["achat", "vente", "dividende", "interets"].includes(d.type);
  const instrumentId = needsInstrument ? d.instrumentId || null : null;
  if (needsInstrument && !instrumentId) return { error: "Choisissez un titre." };
  if ((d.type === "achat" || d.type === "vente") && (!d.quantity || !d.unitPrice)) {
    return { error: "Quantité et prix sont requis pour un achat ou une vente." };
  }
  if (!["achat", "vente"].includes(d.type) && !d.amount) return { error: "Montant requis." };
  for (const v of [d.quantity, d.unitPrice, d.amount, d.fees, d.taxes]) {
    if (v && new Decimal(v).isNeg())
      return { error: "Les montants et quantités sont positifs ; le type indique le sens." };
  }

  const accounts = await db
    .select({ id: investmentAccounts.id })
    .from(investmentAccounts)
    .where(eq(investmentAccounts.userId, user.id));
  const accountIds = accounts.map((a) => a.id);
  const before = instrumentId ? await heldQuantity(accountIds, instrumentId) : new Decimal(0);
  if (d.type === "vente" && before.lt(d.quantity!)) {
    return { error: `Vous ne détenez que ${before.toString()} titres de cet instrument.` };
  }

  // Pour un fonds euros, la quantité est le montant : 1 part = 1 €.
  let quantity = ["achat", "vente"].includes(d.type) ? d.quantity : null;
  let unitPrice = ["achat", "vente"].includes(d.type) ? d.unitPrice : null;
  if (instrumentId) {
    const [inst] = await db.select().from(instruments).where(eq(instruments.id, instrumentId));
    if (inst?.valuationMode === "nominal" && d.type === "interets") quantity = d.amount;
    if (inst?.valuationMode === "nominal" && ["achat", "vente"].includes(d.type)) unitPrice = "1";
  }

  await db.insert(transactions).values({
    accountId: d.accountId,
    instrumentId,
    type: d.type,
    tradeDate: d.tradeDate,
    quantity,
    unitPrice,
    amount: ["achat", "vente"].includes(d.type) ? null : d.amount,
    fees: d.fees ?? "0",
    taxes: d.taxes ?? "0",
    currency: d.currency,
    fxRateToEur: d.fxRateToEur,
    notes: d.notes || null,
  });
  revalidatePath("/", "layout");

  // Invitations (facultatives) du journal de thèse.
  if (d.type === "achat" && before.isZero()) {
    const [active] = await db
      .select({ id: theses.id })
      .from(theses)
      .where(
        and(
          eq(theses.userId, user.id),
          eq(theses.instrumentId, instrumentId!),
          eq(theses.status, "active"),
        ),
      );
    if (!active) redirect(`/transactions?nouvelle_position=${instrumentId}`);
  }
  if (d.type === "vente" && before.minus(d.quantity!).isZero()) {
    const [active] = await db
      .select({ id: theses.id })
      .from(theses)
      .where(
        and(
          eq(theses.userId, user.id),
          eq(theses.instrumentId, instrumentId!),
          eq(theses.status, "active"),
        ),
      );
    if (active) redirect(`/transactions?position_soldee=${active.id}`);
  }
  redirect("/transactions?ajoutee=1");
}

export async function deleteTransaction(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id"));
  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.id, id),
        inArray(
          transactions.accountId,
          db
            .select({ id: investmentAccounts.id })
            .from(investmentAccounts)
            .where(eq(investmentAccounts.userId, user.id)),
        ),
      ),
    );
  revalidatePath("/", "layout");
}
