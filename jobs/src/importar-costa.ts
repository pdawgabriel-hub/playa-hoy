// Descarga la línea de costa de OpenStreetMap y sustituye la guardada:
// pnpm --filter @playa-hoy/jobs importar:costa
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { CONSULTA_COSTA, importarCosta, prepararTramosCosta } from "./costa.ts";
import { consultarOverpass } from "./osm/overpass.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);

// Primero la red, para no tener la conexión abierta mientras Overpass responde
const tramos = prepararTramosCosta(await consultarOverpass(CONSULTA_COSTA));

const { db, cerrar } = crearDb(DATABASE_URL);
try {
  const resultado = await importarCosta(db, tramos);
  console.log(`Costa: ${resultado.tramos} tramos, ${resultado.puntos} puntos`);
} finally {
  await cerrar();
}
