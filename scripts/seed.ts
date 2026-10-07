/** Crée (ou recrée) le profil de démonstration avec ~2 ans d'historique simulé. */
import { eq } from "drizzle-orm";
import { createDb, schema } from "../src/db";
import { loadDemoData } from "../src/db/demo";
import { deleteUserData } from "../src/db/user-data";
import { today } from "../src/lib/dates";

const EMAIL = "demo@compas.local";

async function main() {
  const { db, pool } = createDb();
  const [previous] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, EMAIL));
  if (previous) await deleteUserData(db, previous.id);

  const [user] = await db
    .insert(schema.users)
    .values({ email: EMAIL, name: "Camille (démo)", preferences: { theme: "system" } })
    .returning();
  await loadDemoData(db, user.id, today());

  await pool.end();
  console.log(`Données de démonstration créées pour ${EMAIL}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
