// Descarga la predicción de AEMET de las playas con código de AEMET y guarda la de cada día:
// pnpm --filter @playa-hoy/jobs ingerir:aemet
// Son dos peticiones por playa, espaciadas para no pasar del límite de AEMET. Si falla una
// playa se sigue con las demás. Cada ejecución queda en la tabla `ingestas`; si no se ha
// podido guardar nada, el proceso termina con código 1.
import { crearDb, esquema } from "@playa-hoy/db";
import { esquemaAemet, esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";
import { asc, isNotNull } from "drizzle-orm";

import { consultarPlayasAemet } from "./aemet/playas.ts";
import { registrarIngesta, resumirIngesta } from "./ingestas.ts";
import { filasPrevisionAemet, guardarPrevisionesAemet } from "./playas-aemet.ts";

const { DATABASE_URL, AEMET_API_KEY } = leerEntorno(
  esquemaBaseDatos.extend(esquemaAemet.shape),
  process.env,
);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const registro = await registrarIngesta(db, "aemet", async () => {
    const t = esquema.playas;
    const playas = await db
      .select({ id: t.id, codigoAemet: t.codigoAemet })
      .from(t)
      .where(isNotNull(t.codigoAemet))
      .orderBy(asc(t.codigoAemet));
    if (playas.length === 0) {
      throw new Error("Ninguna playa tiene código de AEMET: ejecuta importar:aemet");
    }

    const { predicciones, errores } = await consultarPlayasAemet(
      playas.map((p) => p.codigoAemet ?? ""),
      AEMET_API_KEY,
    );
    if (predicciones.size === 0) throw new AggregateError(errores.map((e) => new Error(e)));

    const filas = playas.flatMap((playa) => {
      const prediccion = predicciones.get(playa.codigoAemet ?? "");
      return prediccion ? filasPrevisionAemet(playa.id, prediccion) : [];
    });
    // Solo cuenta los días nuevos o con una predicción más reciente
    return { filas: await guardarPrevisionesAemet(db, filas), errores };
  });

  console.log(resumirIngesta(registro));
  if (registro.estado === "error") process.exitCode = 1;
} finally {
  await cerrar();
}
