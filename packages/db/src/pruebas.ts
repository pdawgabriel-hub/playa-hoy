// Utilidades para tests de integración: una base de datos temporal ya migrada.
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { crearDb } from "./cliente.ts";

export const carpetaMigraciones = fileURLToPath(new URL("../migraciones", import.meta.url));

// Crea en el servidor de `url` una base de datos vacía (sin PostGIS, como una recién
// creada en Neon), le aplica las migraciones y devuelve la conexión. `borrar()` la elimina.
export async function crearBaseDatosPrueba(url: string) {
  const nombre = `playahoy_test_${randomUUID().slice(0, 8)}`;
  const admin = postgres(url, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE "${nombre}" TEMPLATE template0`);

  const destino = new URL(url);
  destino.pathname = `/${nombre}`;
  const { db, cerrar } = crearDb(destino.toString());
  await migrate(db, { migrationsFolder: carpetaMigraciones });

  return {
    db,
    borrar: async () => {
      await cerrar();
      await admin.unsafe(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
      await admin.end();
    },
  };
}
