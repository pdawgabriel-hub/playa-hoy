// Descarga la predicción de AEMET de las playas con código de AEMET y guarda la de cada día:
// pnpm --filter @playa-hoy/jobs ingerir:aemet
// Son dos peticiones por playa, espaciadas para no pasar del límite de AEMET.
import { crearDb, esquema } from "@playa-hoy/db";
import { esquemaAemet, esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";
import { asc, isNotNull } from "drizzle-orm";

import { consultarPlayasAemet } from "./aemet/playas.ts";
import { filasPrevisionAemet, guardarPrevisionesAemet } from "./playas-aemet.ts";

const { DATABASE_URL, AEMET_API_KEY } = leerEntorno(
  esquemaBaseDatos.extend(esquemaAemet.shape),
  process.env,
);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const t = esquema.playas;
  const playas = await db
    .select({ id: t.id, codigoAemet: t.codigoAemet })
    .from(t)
    .where(isNotNull(t.codigoAemet))
    .orderBy(asc(t.codigoAemet));
  if (playas.length === 0)
    throw new Error("Ninguna playa tiene código de AEMET: ejecuta importar:aemet");

  const predicciones = await consultarPlayasAemet(
    playas.map((p) => p.codigoAemet ?? ""),
    AEMET_API_KEY,
  );
  const filas = playas.flatMap((playa) => {
    const prediccion = predicciones.get(playa.codigoAemet ?? "");
    return prediccion ? filasPrevisionAemet(playa.id, prediccion) : [];
  });
  const guardadas = await guardarPrevisionesAemet(db, filas);

  console.log(
    `AEMET: ${guardadas.toString()} días nuevos o actualizados de ${playas.length.toString()} playas`,
  );
} finally {
  await cerrar();
}
