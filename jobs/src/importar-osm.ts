// Recalcula los servicios de OpenStreetMap (socorrista, perros, aseos, duchas) de todas las
// playas: pnpm --filter @playa-hoy/jobs importar:osm
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { consultarOverpass } from "./osm/overpass.ts";
import { CONSULTA_SERVICIOS, importarServiciosOsm, prepararDatosOsm } from "./servicios-osm.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);

// Primero la red, para no tener la conexión abierta mientras Overpass responde
const datos = prepararDatosOsm(await consultarOverpass(CONSULTA_SERVICIOS));
console.log(`OSM: ${datos.playas.length} playas y ${datos.servicios.length} servicios cercanos`);

const { db, cerrar } = crearDb(DATABASE_URL);
try {
  const { playasConDatos } = await importarServiciosOsm(db, datos);
  console.log(`OSM: ${playasConDatos} playas con algún dato de servicios`);
} finally {
  await cerrar();
}
