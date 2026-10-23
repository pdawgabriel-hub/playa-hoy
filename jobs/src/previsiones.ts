import { type Db, esquema } from "@playa-hoy/db";
import { and, eq, exists, gt, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { PrevisionTiempo } from "./open-meteo/forecast.ts";
import type { PrevisionMarina } from "./open-meteo/marine.ts";

// Durante estos días se guardan todas las emisiones. Después, de cada hora solo queda la
// última previsión que se hizo antes de que llegara (ver docs/fuentes.md).
export const DIAS_RETENCION = 14;

const HORA_MS = 3_600_000;
// Muy por debajo del límite de parámetros de PostgreSQL (65.535): 12 columnas por fila
const FILAS_POR_INSERCION = 1000;

export type FilaPrevision = typeof esquema.previsiones.$inferInsert;

// La emisión se identifica por la hora de la descarga: repetir la ingesta dentro de la misma
// hora sobrescribe esa emisión en lugar de crear otra.
export const truncarHora = (fecha: Date) =>
  new Date(Math.floor(fecha.getTime() / HORA_MS) * HORA_MS);

// Junta el oleaje y el tiempo de un punto hora a hora. Open-Meteo devuelve el día entero,
// también las horas ya pasadas: solo se guardan desde la hora de la emisión. Si una hora
// falta en una de las dos respuestas, sus variables quedan en nulo.
export function combinarPrevisiones(
  puntoId: number,
  emitidaEn: Date,
  marina: PrevisionMarina,
  tiempo: PrevisionTiempo,
): FilaPrevision[] {
  const olas = new Map(marina.horas.map((h) => [h.hora.getTime(), h]));
  const tiempos = new Map(tiempo.horas.map((h) => [h.hora.getTime(), h]));
  const horas = [...new Set([...olas.keys(), ...tiempos.keys()])]
    .filter((hora) => hora >= emitidaEn.getTime())
    .toSorted((a, b) => a - b);

  return horas.map((hora) => {
    const o = olas.get(hora);
    const t = tiempos.get(hora);
    return {
      puntoId,
      emitidaEn,
      hora: new Date(hora),
      vientoVelocidad: t?.vientoVelocidad ?? null,
      vientoDireccion: t?.vientoDireccion ?? null,
      vientoRacha: t?.vientoRacha ?? null,
      temperaturaAire: t?.temperaturaAire ?? null,
      nubosidad: t?.nubosidad ?? null,
      olaAltura: o?.olaAltura ?? null,
      olaDireccion: o?.olaDireccion ?? null,
      olaPeriodo: o?.olaPeriodo ?? null,
      temperaturaAgua: o?.temperaturaAgua ?? null,
    };
  });
}

// Guarda las filas en una transacción: o entra la emisión entera o no entra nada. Si la
// emisión ya existe, sus valores se sustituyen por los nuevos.
export async function guardarPrevisiones(db: Db, filas: FilaPrevision[]) {
  const t = esquema.previsiones;
  await db.transaction(async (tx) => {
    for (let i = 0; i < filas.length; i += FILAS_POR_INSERCION) {
      await tx
        .insert(t)
        .values(filas.slice(i, i + FILAS_POR_INSERCION))
        .onConflictDoUpdate({
          target: [t.puntoId, t.emitidaEn, t.hora],
          set: {
            vientoVelocidad: sql`excluded.viento_velocidad`,
            vientoDireccion: sql`excluded.viento_direccion`,
            vientoRacha: sql`excluded.viento_racha`,
            temperaturaAire: sql`excluded.temperatura_aire`,
            nubosidad: sql`excluded.nubosidad`,
            olaAltura: sql`excluded.ola_altura`,
            olaDireccion: sql`excluded.ola_direccion`,
            olaPeriodo: sql`excluded.ola_periodo`,
            temperaturaAgua: sql`excluded.temperatura_agua`,
          },
        });
    }
  });
  return filas.length;
}

// De las horas que pasaron hace más de DIAS_RETENCION días, borra todas las emisiones menos
// la última. Devuelve cuántas filas ha borrado.
export async function aplicarRetencion(db: Db, ahora: Date, dias = DIAS_RETENCION) {
  const t = esquema.previsiones;
  const posterior = alias(t, "posterior");
  const limite = new Date(ahora.getTime() - dias * 24 * HORA_MS);

  const borradas = await db
    .delete(t)
    .where(
      and(
        lt(t.hora, limite),
        exists(
          db
            .select({ uno: sql`1` })
            .from(posterior)
            .where(
              and(
                eq(posterior.puntoId, t.puntoId),
                eq(posterior.hora, t.hora),
                gt(posterior.emitidaEn, t.emitidaEn),
              ),
            ),
        ),
      ),
    )
    .returning({ hora: t.hora });
  return borradas.length;
}
