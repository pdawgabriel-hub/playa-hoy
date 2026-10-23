// Descarga la previsión de Open-Meteo de cada punto de consulta y la guarda como una emisión
// nueva: pnpm --filter @playa-hoy/jobs ingerir:previsiones
// Se puede repetir: dentro de la misma hora sobrescribe la emisión en lugar de duplicarla.
// Cada ejecución queda en la tabla `ingestas`; si falla, el proceso termina con código 1.
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { registrarIngesta, resumirIngesta } from "./ingestas.ts";
import { ingerirPrevisiones } from "./previsiones.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const registro = await registrarIngesta(db, "open_meteo", () => ingerirPrevisiones(db));
  console.log(resumirIngesta(registro));
  if (registro.estado === "error") process.exitCode = 1;
} finally {
  await cerrar();
}
