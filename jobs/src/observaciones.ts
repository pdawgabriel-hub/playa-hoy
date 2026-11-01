import { type Db, esquema, sql } from "@playa-hoy/db";

import {
  ESTACIONES_AEMET,
  type ObservacionEstacion,
  consultarEstacionesAemet,
} from "./aemet/observaciones.ts";
import type { OpcionesAemet } from "./aemet/comun.ts";
import type { ResultadoTarea } from "./ingestas.ts";

const NOMBRES = new Map<string, string>(ESTACIONES_AEMET.map((e) => [e.id, e.nombre]));

// Guarda las estaciones (con la ubicación y la altitud que da AEMET) y sus horas observadas,
// en una transacción. Una hora que ya estaba se sustituye: AEMET a veces corrige un dato, y
// repetir la descarga no duplica nada. Devuelve cuántas horas ha guardado.
export async function guardarObservaciones(db: Db, observaciones: ObservacionEstacion[]) {
  const { estaciones: tEstaciones, observaciones: tObservaciones } = esquema;
  return db.transaction(async (tx) => {
    let horas = 0;
    for (const { id, ubicacion, altitud, horas: filas } of observaciones) {
      const estacion = {
        nombre: NOMBRES.get(id) ?? id,
        ubicacion: { x: ubicacion.lon, y: ubicacion.lat },
        altitud,
      };
      await tx
        .insert(tEstaciones)
        .values({ id, fuente: "aemet", ...estacion })
        .onConflictDoUpdate({ target: tEstaciones.id, set: estacion });

      if (filas.length === 0) continue;
      await tx
        .insert(tObservaciones)
        .values(filas.map((f) => ({ estacionId: id, ...f })))
        .onConflictDoUpdate({
          target: [tObservaciones.estacionId, tObservaciones.hora],
          set: {
            vientoVelocidad: sql`excluded.viento_velocidad`,
            vientoDireccion: sql`excluded.viento_direccion`,
            vientoRacha: sql`excluded.viento_racha`,
            temperaturaAire: sql`excluded.temperatura_aire`,
          },
        });
      horas += filas.length;
    }
    return horas;
  });
}

// La ingesta completa de las observaciones de AEMET: descarga las estaciones de la costa y
// guarda sus horas. Si falla una estación se sigue con las demás; si no se ha podido
// descargar ninguna, lanza un error.
export async function ingerirObservaciones(
  db: Db,
  clave: string,
  opciones: OpcionesAemet = {},
): Promise<ResultadoTarea> {
  const { observaciones, errores } = await consultarEstacionesAemet(
    ESTACIONES_AEMET.map((e) => e.id),
    clave,
    opciones,
  );
  if (observaciones.size === 0) throw new AggregateError(errores.map((e) => new Error(e)));
  return { filas: await guardarObservaciones(db, [...observaciones.values()]), errores };
}
