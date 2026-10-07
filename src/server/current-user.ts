import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { users } from "@/db/schema";
import { db } from "./db";

export const USER_COOKIE = "compas_uid";

/**
 * Utilisateur courant.
 *
 * V1 locale, mono-utilisateur : pas encore d'authentification (Auth.js prévu avant toute mise
 * en ligne). Le profil est mémorisé dans un cookie ; à défaut on prend le premier profil.
 * Toutes les requêtes et actions passent par cette fonction : brancher l'authentification
 * ne demandera de modifier qu'ici.
 */
export async function getCurrentUser() {
  const jar = await cookies();
  const id = jar.get(USER_COOKIE)?.value;
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (user) return user;
  }
  const [first] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  if (!first) redirect("/bienvenue");
  return first;
}

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
