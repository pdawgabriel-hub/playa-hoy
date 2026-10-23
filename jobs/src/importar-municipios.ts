// Importa los municipios costeros: pnpm --filter @playa-hoy/jobs importar:municipios
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import datos from "../datos/municipios.json" with { type: "json" };
import { importarMunicipios, leerMunicipios } from "./municipios.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const municipios = leerMunicipios(datos);
  const { nuevos, actualizados } = await importarMunicipios(db, municipios);
  console.log(`Municipios: ${nuevos} nuevos, ${actualizados} actualizados`);
} finally {
  await cerrar();
}
