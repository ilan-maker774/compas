"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { importBatches, investmentAccounts } from "@/db/schema";
import { importTransactions as runImport, type ImportResult } from "@/db/import-transactions";
import { getCurrentUser } from "../current-user";
import { db } from "../db";

export type { ImportResult };

export async function importTransactions(payload: unknown): Promise<ImportResult> {
  const user = await getCurrentUser();
  const result = await runImport(db, user.id, payload);
  revalidatePath("/", "layout");
  return result;
}

/** Dernière correspondance utilisée pour ce compte, pour pré-remplir le prochain import. */
export async function lastMapping(accountId: string) {
  const user = await getCurrentUser();
  const [row] = await db
    .select({ mapping: importBatches.columnMapping })
    .from(importBatches)
    .innerJoin(investmentAccounts, eq(importBatches.accountId, investmentAccounts.id))
    .where(and(eq(importBatches.accountId, accountId), eq(investmentAccounts.userId, user.id)))
    .orderBy(desc(importBatches.importedAt))
    .limit(1);
  return row?.mapping ?? null;
}
