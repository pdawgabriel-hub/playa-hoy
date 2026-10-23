import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as esquema from "./esquema/index.ts";

export function crearDb(url: string) {
  // prepare: false porque el pool de conexiones de Neon (PgBouncer) no admite prepared statements.
  const cliente = postgres(url, { prepare: false, max: 5 });
  const db = drizzle(cliente, { schema: esquema, casing: "snake_case" });
  return { db, cerrar: () => cliente.end() };
}

export type Db = ReturnType<typeof crearDb>["db"];
