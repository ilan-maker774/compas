"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { users } from "@/db/schema";
import { deleteUserData } from "@/db/user-data";
import { getCurrentUser, USER_COOKIE } from "../current-user";
import { db } from "../db";
import { type ActionState, firstIssue, formObject } from "./state";

const prefsSchema = z.object({
  name: z.string().trim().max(80).optional(),
  theme: z.enum(["system", "light", "dark"]),
  benchmarkInstrumentId: z.string().optional(),
});

export async function updateSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = prefsSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await db
    .update(users)
    .set({
      name: parsed.data.name || null,
      benchmarkInstrumentId: parsed.data.benchmarkInstrumentId || null,
      preferences: { ...user.preferences, theme: parsed.data.theme },
    })
    .where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { message: "Préférences enregistrées." };
}

/** Droit à l'effacement : suppression définitive de toutes les données de l'utilisateur. */
export async function deleteMyData(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (String(formData.get("confirm")).trim().toLowerCase() !== user.email.toLowerCase()) {
    return { error: "Saisissez votre adresse e-mail exacte pour confirmer." };
  }
  await deleteUserData(db, user.id);
  (await cookies()).delete(USER_COOKIE);
  redirect("/bienvenue");
}
