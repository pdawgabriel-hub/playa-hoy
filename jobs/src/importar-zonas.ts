// Crea las zonas y asigna su zona a cada playa: pnpm --filter @playa-hoy/jobs importar:zonas
// Antes hay que importar las playas del censo.
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import datos from "../datos/zonas.json" with { type: "json" };
import { importarZonas, leerZonas } from "./zonas.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const { zonas, playas, borradas } = await importarZonas(db, leerZonas(datos));
  console.log(`Zonas: ${zonas} zonas, ${playas} playas asignadas`);
  if (borradas.length > 0)
    console.log(`  Zonas borradas (ya no existen y no tenían playas): ${borradas.join(", ")}`);
} finally {
  await cerrar();
}
