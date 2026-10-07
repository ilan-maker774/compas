"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { investmentAccounts } from "@/db/schema";
import { getCurrentUser } from "../current-user";
import { db } from "../db";
import { type ActionState, firstIssue, formObject } from "./state";

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  type: z.enum(["pea", "pea_pme", "cto", "assurance_vie", "per", "autre"]),
  institution: z.string().trim().max(80).optional(),
  openedOn: z.string().optional(),
});

export async function createAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = schema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await db.insert(investmentAccounts).values({
    userId: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    institution: parsed.data.institution || null,
    openedOn: parsed.data.openedOn || null,
  });
  revalidatePath("/comptes");
  return { message: "Compte créé." };
}

export async function deleteAccount(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id"));
  await db
    .delete(investmentAccounts)
    .where(and(eq(investmentAccounts.id, id), eq(investmentAccounts.userId, user.id)));
  revalidatePath("/", "layout");
  redirect("/comptes");
}
