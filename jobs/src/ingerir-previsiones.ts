// Descarga la previsión de Open-Meteo de cada punto de consulta y la guarda como una emisión
// nueva: pnpm --filter @playa-hoy/jobs ingerir:previsiones
// Se puede repetir: dentro de la misma hora sobrescribe la emisión en lugar de duplicarla.
// Cada ejecución queda en la tabla `ingestas`; si falla, el proceso termina con código 1.
import { crearDb, esquema } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";
import { asc, eq, exists } from "drizzle-orm";

import { registrarIngesta, resumirIngesta } from "./ingestas.ts";
import { consultarForecast } from "./open-meteo/forecast.ts";
import { consultarMarine } from "./open-meteo/marine.ts";
import {
  aplicarRetencion,
  combinarPrevisiones,
  guardarPrevisiones,
  truncarHora,
} from "./previsiones.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const registro = await registrarIngesta(db, "open_meteo", async () => {
    const { puntosConsulta: tPuntos, playas: tPlayas } = esquema;
    // Los puntos que se quedaron sin playas se conservan por su histórico, pero no se piden
    const puntos = await db
      .select({ id: tPuntos.id, ubicacion: tPuntos.ubicacion })
      .from(tPuntos)
      .where(exists(db.select().from(tPlayas).where(eq(tPlayas.puntoConsultaId, tPuntos.id))))
      .orderBy(asc(tPuntos.id));
    if (puntos.length === 0) throw new Error("No hay puntos de consulta: ejecuta calcular:puntos");

    const ahora = new Date();
    const emitidaEn = truncarHora(ahora);
    const coordenadas = puntos.map((p) => ({ lat: p.ubicacion.y, lon: p.ubicacion.x }));
    // Una emisión sin oleaje o sin viento no se guarda: la anterior sigue siendo válida
    const [marina, tiempo] = await Promise.allSettled([
      consultarMarine(coordenadas),
      consultarForecast(coordenadas),
    ]);
    if (marina.status === "rejected" || tiempo.status === "rejected") {
      throw new AggregateError(
        [marina, tiempo].flatMap((r) => (r.status === "rejected" ? [r.reason] : [])),
      );
    }

    const filas = puntos.flatMap((punto, i) => {
      const m = marina.value[i];
      const t = tiempo.value[i];
      if (!m || !t) throw new Error(`Falta la previsión del punto ${punto.id.toString()}`);
      return combinarPrevisiones(punto.id, emitidaEn, m, t);
    });
    const guardadas = await guardarPrevisiones(db, filas);
    const borradas = await aplicarRetencion(db, ahora);
    console.log(
      `Emisión ${emitidaEn.toISOString()}: ${guardadas.toString()} horas de ${puntos.length.toString()} puntos` +
        (borradas ? ` (retención: ${borradas.toString()} filas antiguas borradas)` : ""),
    );
    return { filas: guardadas, errores: [] };
  });

  console.log(resumirIngesta(registro));
  if (registro.estado === "error") process.exitCode = 1;
} finally {
  await cerrar();
}
