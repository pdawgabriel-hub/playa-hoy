// Calcula la orientación, el abrigo y si es de laguna de cada playa a partir de la costa:
// pnpm --filter @playa-hoy/jobs calcular:geografia
// Antes hay que importar las playas y la costa.
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import excepciones from "../datos/excepciones-costa.json" with { type: "json" };
import {
  CONSULTA_MAR_MENOR,
  calcularGeografiaPlayas,
  geometriaMarMenor,
  leerExcepciones,
} from "./geografia-playas.ts";
import { consultarOverpass } from "./osm/overpass.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);

// Primero la red, para no tener la conexión abierta mientras Overpass responde
const marMenor = geometriaMarMenor(await consultarOverpass(CONSULTA_MAR_MENOR));

const { db, cerrar } = crearDb(DATABASE_URL);
try {
  const resultado = await calcularGeografiaPlayas(db, marMenor, leerExcepciones(excepciones));
  console.log(`Geografía: ${resultado.playas} playas, ${resultado.laguna} de laguna`);
  for (const nombre of resultado.sinOrientacion)
    console.log(`  Sin orientación (no hay costa cerca): ${nombre}`);
} finally {
  await cerrar();
}
