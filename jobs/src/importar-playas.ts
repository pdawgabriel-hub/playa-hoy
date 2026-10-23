// Importa las playas del censo de aguas de baño: pnpm --filter @playa-hoy/jobs importar:playas
// Usa el censo más reciente de jobs/datos (censo-<año>-murcia.json). Antes hay que importar
// los municipios.
import { readdir, readFile } from "node:fs/promises";

import { crearDb, esquema } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import correcciones from "../datos/correcciones-censo.json" with { type: "json" };
import { importarPlayasCenso, prepararPlayasCenso } from "./playas-censo.ts";

const carpeta = new URL("../datos/", import.meta.url);
const ficheros = (await readdir(carpeta))
  .filter((f) => /^censo-\d{4}-murcia\.json$/.test(f))
  .toSorted();
const ultimo = ficheros.at(-1);
if (!ultimo)
  throw new Error(
    "No hay ningún censo en jobs/datos (pnpm --filter @playa-hoy/jobs extraer:censo)",
  );
const censo: unknown = JSON.parse(await readFile(new URL(ultimo, carpeta), "utf8"));

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const municipios = await db
    .select({ id: esquema.municipios.id, slug: esquema.municipios.slug })
    .from(esquema.municipios);
  const { playas, descartadas } = prepararPlayasCenso(
    censo,
    correcciones,
    new Map(municipios.map((m) => [m.id, m.slug])),
  );
  const { nuevas, actualizadas } = await importarPlayasCenso(db, playas);

  console.log(`Censo ${ultimo}: ${nuevas} playas nuevas, ${actualizadas} actualizadas`);
  for (const d of descartadas)
    console.log(`  Descartada (segundo punto de muestreo de la misma playa): ${d}`);
} finally {
  await cerrar();
}
