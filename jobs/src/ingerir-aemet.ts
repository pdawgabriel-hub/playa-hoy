// Descarga la predicción de AEMET de las playas con código de AEMET y guarda la de cada día:
// pnpm --filter @playa-hoy/jobs ingerir:aemet
// Son dos peticiones por playa, espaciadas para no pasar del límite de AEMET. Si falla una
// playa se sigue con las demás. Cada ejecución queda en la tabla `ingestas`; si no se ha
// podido guardar nada, el proceso termina con código 1.
import { crearDb } from "@playa-hoy/db";
import { esquemaAemet, esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { registrarIngesta, resumirIngesta } from "./ingestas.ts";
import { ingerirAemet } from "./playas-aemet.ts";

const { DATABASE_URL, AEMET_API_KEY } = leerEntorno(
  esquemaBaseDatos.extend(esquemaAemet.shape),
  process.env,
);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const registro = await registrarIngesta(db, "aemet", () => ingerirAemet(db, AEMET_API_KEY));
  console.log(resumirIngesta(registro));
  if (registro.estado === "error") process.exitCode = 1;
} finally {
  await cerrar();
}
