// Pone a las playas su código de la predicción de playas de AEMET según la tabla de
// correspondencias revisada: pnpm --filter @playa-hoy/jobs importar:aemet
// Antes hay que importar las playas del censo.
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import correspondencias from "../datos/correspondencias-aemet.json" with { type: "json" };
import { importarCodigosAemet, leerCorrespondenciasAemet } from "./playas-aemet.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const playas = await importarCodigosAemet(db, leerCorrespondenciasAemet(correspondencias));
  console.log(`AEMET: código de ${playas.toString()} playas`);
} finally {
  await cerrar();
}
