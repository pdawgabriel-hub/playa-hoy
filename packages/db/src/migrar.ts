// Aplica las migraciones pendientes: pnpm db:migrate
import { fileURLToPath } from "node:url";

import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { crearDb } from "./cliente.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../migraciones", import.meta.url)),
  });
  console.log("Migraciones aplicadas");
} finally {
  await cerrar();
}
