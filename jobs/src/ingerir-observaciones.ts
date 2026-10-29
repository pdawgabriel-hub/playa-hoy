// Descarga las observaciones de las estaciones de AEMET de la costa y las guarda:
// pnpm --filter @playa-hoy/jobs ingerir:observaciones
// AEMET solo guarda las últimas horas: hay que ejecutarlo varias veces al día. Se puede
// repetir sin duplicar nada. Cada ejecución queda en la tabla `ingestas`; si no se ha podido
// guardar nada, el proceso termina con código 1.
import { crearDb } from "@playa-hoy/db";
import { esquemaAemet, esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { registrarIngesta, resumirIngesta } from "./ingestas.ts";
import { ingerirObservaciones } from "./observaciones.ts";

const { DATABASE_URL, AEMET_API_KEY } = leerEntorno(
  esquemaBaseDatos.extend(esquemaAemet.shape),
  process.env,
);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const registro = await registrarIngesta(db, "aemet_observaciones", () =>
    ingerirObservaciones(db, AEMET_API_KEY),
  );
  console.log(resumirIngesta(registro));
  if (registro.estado === "error") process.exitCode = 1;
} finally {
  await cerrar();
}
