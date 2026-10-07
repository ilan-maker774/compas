import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db";

/** Repart d'une base de test vierge et applique les migrations. */
export default async function setup() {
  process.loadEnvFile?.(".env");
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL n'est pas défini (voir .env.example)");
  const { db, pool } = createDb(url);
  await pool.query(
    "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
  );
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}
