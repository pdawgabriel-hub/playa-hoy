import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as esquema from "./esquema/index.ts";

export function crearDb(url: string) {
  // prepare: false porque el pool de conexiones de Neon (PgBouncer) no admite prepared statements.
  // La sesión en UTC: now()::date, date_trunc y similares no dependen de cómo esté
  // configurado el servidor.
  const cliente = postgres(url, { prepare: false, max: 5, connection: { TimeZone: "UTC" } });
  const db = drizzle(cliente, { schema: esquema, casing: "snake_case" });
  return { db, cerrar: () => cliente.end() };
}

export type Db = ReturnType<typeof crearDb>["db"];
