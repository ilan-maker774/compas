import "server-only";
import { createDb, type Db } from "@/db";

// Une seule connexion par processus (y compris lors du rechargement à chaud en développement).
const globalForDb = globalThis as unknown as { compasDb?: Db };

export const db: Db = globalForDb.compasDb ?? createDb().db;
if (process.env.NODE_ENV !== "production") globalForDb.compasDb = db;
