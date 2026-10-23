import { type Db, esquema } from "@playa-hoy/db";
import { and, eq, inArray, notExists, notInArray } from "drizzle-orm";

import type { Coordenadas } from "./open-meteo/comun.ts";

export type PlayaConCeldas = {
  id: number;
  ubicacion: Coordenadas;
  // Celdas del modelo de Open-Meteo en las que cae la playa
  celdaMarina: Coordenadas;
  celdaViento: Coordenadas;
  celdaTiempo: Coordenadas;
};

export type Grupo = { celdas: string; ubicacion: Coordenadas; playas: number[] };

const texto = (c: Coordenadas) => `${c.lat},${c.lon}`;

// Agrupa las playas que caen en las mismas tres celdas: reciben exactamente la misma
// previsión, así que se pide y se guarda una vez. El punto del grupo es la ubicación de su
// playa de menor id (un punto cualquiera del grupo podría caer en otras celdas).
export function agruparPorCeldas(playas: PlayaConCeldas[]): Grupo[] {
  const grupos = new Map<string, PlayaConCeldas[]>();
  for (const playa of playas) {
    const celdas = [playa.celdaMarina, playa.celdaViento, playa.celdaTiempo].map(texto).join("|");
    grupos.set(celdas, [...(grupos.get(celdas) ?? []), playa]);
  }
  return [...grupos.entries()].map(([celdas, miembros]) => {
    const ordenados = miembros.toSorted((a, b) => a.id - b.id);
    return {
      celdas,
      ubicacion: ordenados[0]?.ubicacion ?? { lat: 0, lon: 0 },
      playas: ordenados.map((p) => p.id),
    };
  });
}

// Guarda los puntos de consulta y enlaza cada playa con el suyo, en una transacción.
export async function importarPuntosConsulta(db: Db, grupos: Grupo[]) {
  const { puntosConsulta: tPuntos, playas: tPlayas, previsiones: tPrevisiones } = esquema;

  return db.transaction(async (tx) => {
    let enlazadas = 0;
    const ids: number[] = [];
    for (const grupo of grupos) {
      const ubicacion = { x: grupo.ubicacion.lon, y: grupo.ubicacion.lat };
      const [punto] = await tx
        .insert(tPuntos)
        .values({ celdas: grupo.celdas, ubicacion })
        .onConflictDoUpdate({ target: tPuntos.celdas, set: { ubicacion } })
        .returning({ id: tPuntos.id });
      if (!punto) throw new Error(`No se pudo guardar el punto ${grupo.celdas}`);
      ids.push(punto.id);

      const filas = await tx
        .update(tPlayas)
        .set({ puntoConsultaId: punto.id })
        .where(inArray(tPlayas.id, grupo.playas))
        .returning({ id: tPlayas.id });
      enlazadas += filas.length;
    }

    // Puntos que se han quedado sin playas: se borran solo si no tienen previsiones. Las
    // que tienen se conservan para medir la fiabilidad.
    const borrados = await tx
      .delete(tPuntos)
      .where(
        and(
          notInArray(tPuntos.id, ids),
          notExists(tx.select().from(tPrevisiones).where(eq(tPrevisiones.puntoId, tPuntos.id))),
        ),
      )
      .returning({ id: tPuntos.id });

    return { puntos: ids.length, playas: enlazadas, borrados: borrados.length };
  });
}
