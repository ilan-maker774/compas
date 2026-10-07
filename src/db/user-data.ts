import { eq } from "drizzle-orm";
import type { Db } from ".";
import { investmentAccounts, theses, users } from "./schema";

/**
 * Suppression complète d'un compte utilisateur (droit à l'effacement, RGPD).
 *
 * L'ordre compte : transactions et thèses référencent des instruments (y compris les
 * instruments privés de l'utilisateur), elles doivent disparaître avant eux.
 * Le reste (comptes, imports, métriques, revues, clôtures, instruments privés) part en cascade.
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(investmentAccounts).where(eq(investmentAccounts.userId, userId));
    await tx.delete(theses).where(eq(theses.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
