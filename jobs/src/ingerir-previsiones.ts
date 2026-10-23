// Descarga la previsión de Open-Meteo de cada punto de consulta y la guarda como una emisión
// nueva: pnpm --filter @playa-hoy/jobs ingerir:previsiones
// Se puede repetir: dentro de la misma hora sobrescribe la emisión en lugar de duplicarla.
import { crearDb, esquema } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";
import { asc, eq, exists } from "drizzle-orm";

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
  const [marina, tiempo] = await Promise.all([
    consultarMarine(coordenadas),
    consultarForecast(coordenadas),
  ]);

  const filas = puntos.flatMap((punto, i) => {
    const m = marina[i];
    const t = tiempo[i];
    if (!m || !t) throw new Error(`Falta la previsión del punto ${punto.id.toString()}`);
    return combinarPrevisiones(punto.id, emitidaEn, m, t);
  });
  const guardadas = await guardarPrevisiones(db, filas);
  const borradas = await aplicarRetencion(db, ahora);

  console.log(
    `Emisión ${emitidaEn.toISOString()}: ${guardadas.toString()} horas de ${puntos.length.toString()} puntos` +
      (borradas ? ` (retención: ${borradas.toString()} filas antiguas borradas)` : ""),
  );
} finally {
  await cerrar();
}
