"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loadDemoData } from "@/db/demo";
import { users } from "@/db/schema";
import { today } from "@/lib/dates";
import { USER_COOKIE } from "../current-user";
import { db } from "../db";
import { type ActionState, firstIssue, formObject } from "./state";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  name: z.string().trim().max(80).optional(),
  demo: z.string().optional(),
});

export async function createProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const [existing] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (existing) return { error: "Un profil existe déjà avec cette adresse." };
  const [user] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      name: parsed.data.name || null,
      preferences: { theme: "system" },
    })
    .returning();
  if (parsed.data.demo === "on") await loadDemoData(db, user.id, today());
  (await cookies()).set(USER_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}
