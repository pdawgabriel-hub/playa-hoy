import { abanicoDeRayos, calcularAbrigo, calcularOrientacion } from "@playa-hoy/core";
import { type Db, esquema } from "@playa-hoy/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { ElementoOsm } from "./osm/overpass.ts";
import { geometriaPlaya } from "./osm/servicios.ts";

// El Mar Menor en OpenStreetMap: relación natural=bay
export const CONSULTA_MAR_MENOR = `[out:json][timeout:120];relation(2902374);out geom;`;

// Una playa es de laguna si está a menos de esta distancia del polígono del Mar Menor.
// Las de la laguna están a 15 m o menos (son su orilla); las demás, a 155 m o más.
const DISTANCIA_LAGUNA_M = 50;
// Hasta dónde se lanzan los rayos para medir el alcance hacia el mar
const LARGO_RAYO_M = 50_000;
// Los cortes con la costa a menos de esta distancia son la orilla de la propia playa
const ORILLA_PROPIA_M = 300;

export function geometriaMarMenor(elementos: ElementoOsm[]) {
  const relacion = elementos.find((e) => e.type === "relation");
  const geometria = relacion ? geometriaPlaya(relacion) : null;
  if (!geometria) throw new Error("OSM no ha devuelto el polígono del Mar Menor");
  return geometria;
}

const esquemaExcepciones = z.object({
  laguna: z.array(z.object({ codigo: z.string(), laguna: z.boolean(), motivo: z.string().min(1) })),
});

export function leerExcepciones(datos: unknown) {
  return esquemaExcepciones.parse(datos);
}

type Excepciones = ReturnType<typeof leerExcepciones>;

// Calcula y guarda la orientación, el abrigo y si es de laguna de todas las playas.
export async function calcularGeografiaPlayas(db: Db, marMenor: object, excepciones: Excepciones) {
  const { playas: tPlayas, costa: tCosta } = esquema;
  const lagunaForzada = new Map(excepciones.laguna.map((e) => [e.codigo, e.laguna]));

  // Distancia de cada playa al polígono del Mar Menor
  const distancias = await db.execute<{ id: number; distancia: number }>(sql`
    WITH mar_menor AS (SELECT ST_BuildArea(ST_GeomFromGeoJSON(${JSON.stringify(marMenor)})) AS geom)
    SELECT p.id, ST_Distance(p.ubicacion::geography, m.geom::geography) AS distancia
    FROM playas p, mar_menor m
  `);
  const distanciaMarMenor = new Map(distancias.map((d) => [d.id, d.distancia]));

  const playas = await db.select().from(tPlayas);
  const resultados: {
    id: number;
    nombre: string;
    mira: number | null;
    abrigo: number | null;
    laguna: boolean;
  }[] = [];
  for (const playa of playas) {
    const { x: lon, y: lat } = playa.ubicacion;
    const punto = sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;

    const tramos = await db
      .select({ linea: tCosta.linea })
      .from(tCosta)
      .where(sql`ST_DWithin(${tCosta.linea}::geography, ${punto}::geography, 3000)`);
    const orientacion = calcularOrientacion(
      { lon, lat },
      tramos.map((t) => t.linea.map(({ x, y }) => ({ lon: x, lat: y }))),
    );

    let abrigo: number | null = null;
    if (orientacion) {
      // Alcance de cada rayo: distancia al primer corte con la costa más allá de la orilla
      const azimuts = abanicoDeRayos(orientacion.mira);
      const cortes = await db.execute<{ azimut: number; distancia: number }>(sql`
        SELECT azimut, min(distancia) AS distancia FROM (
          SELECT azimut,
                 ST_Distance(${punto}::geography, (ST_Dump(ST_Intersection(c.linea, rayo.geom))).geom::geography) AS distancia
          FROM unnest(${`{${azimuts.join(",")}}`}::float8[]) AS azimut
          CROSS JOIN LATERAL (
            SELECT ST_MakeLine(${punto}, ST_Project(${punto}::geography, ${LARGO_RAYO_M}::float8, radians(azimut))::geometry) AS geom
          ) rayo
          JOIN costa c ON ST_Intersects(c.linea, rayo.geom)
        ) cortes
        WHERE distancia > ${ORILLA_PROPIA_M}
        GROUP BY azimut
      `);
      const alcance = new Map(cortes.map((c) => [c.azimut, c.distancia]));
      abrigo = calcularAbrigo(
        orientacion.mira,
        azimuts.map((azimut) => ({ azimut, distanciaM: alcance.get(azimut) ?? LARGO_RAYO_M })),
      );
    }

    const laguna =
      lagunaForzada.get(playa.codigoCenso ?? "") ??
      (distanciaMarMenor.get(playa.id) ?? Number.POSITIVE_INFINITY) < DISTANCIA_LAGUNA_M;

    resultados.push({
      id: playa.id,
      nombre: playa.nombre,
      mira: orientacion?.mira ?? null,
      abrigo,
      laguna,
    });
  }

  await db.transaction(async (tx) => {
    for (const { id, mira, abrigo, laguna } of resultados) {
      await tx.update(tPlayas).set({ mira, abrigo, laguna }).where(eq(tPlayas.id, id));
    }
  });

  return {
    playas: resultados.length,
    laguna: resultados.filter((r) => r.laguna).length,
    sinOrientacion: resultados.filter((r) => r.mira === null).map((r) => r.nombre),
  };
}
