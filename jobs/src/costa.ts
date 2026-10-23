import { type Db, esquema } from "@playa-hoy/db";

import type { ElementoOsm } from "./osm/overpass.ts";

// Costa de la Región de Murcia con margen: incluye un poco de Almería y de Alicante, que
// también cuenta para saber cuánto mar abierto tiene cada playa cerca del límite.
export const CONSULTA_COSTA = `
[out:json][timeout:180];
way["natural"="coastline"](37.30,-1.85,37.95,-0.60);
out geom;
`;

export type TramoCosta = { id: string; linea: { x: number; y: number }[] };

export function prepararTramosCosta(elementos: ElementoOsm[]): TramoCosta[] {
  return elementos
    .filter((e) => e.type === "way" && e.tags?.natural === "coastline" && e.geometry)
    .map((e) => ({
      id: `way/${e.id}`,
      // Se conserva el orden: el mar queda a la derecha del sentido de la línea
      linea: (e.geometry ?? []).filter((p) => p !== null).map((p) => ({ x: p.lon, y: p.lat })),
    }))
    .filter((t) => t.linea.length >= 2);
}

// Sustituye la costa guardada por la nueva, en una transacción.
export async function importarCosta(db: Db, tramos: TramoCosta[]) {
  // Una respuesta vacía de Overpass no puede dejar todas las playas sin costa
  if (tramos.length === 0)
    throw new Error("No hay tramos de costa: no se sustituye la costa guardada");

  return db.transaction(async (tx) => {
    await tx.delete(esquema.costa);
    await tx.insert(esquema.costa).values(tramos);
    return { tramos: tramos.length, puntos: tramos.reduce((suma, t) => suma + t.linea.length, 0) };
  });
}
