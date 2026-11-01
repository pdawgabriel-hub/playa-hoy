import { type Db, sql } from "@playa-hoy/db";

import type { ElementoOsm } from "./osm/overpass.ts";
import {
  geometriaPlaya,
  puntoDeServicio,
  serviciosDeEtiquetas,
  tipoDeServicio,
} from "./osm/servicios.ts";

// Playas de la Región de Murcia y servicios a menos de 150 m de alguna de ellas
export const CONSULTA_SERVICIOS = `
[out:json][timeout:180];
area["ISO3166-2"="ES-MU"]->.region;
(way["natural"="beach"](area.region); relation["natural"="beach"](area.region);)->.playas;
.playas out tags geom;
(
  nwr(around.playas:150)["amenity"~"^(toilets|shower)$"];
  nwr(around.playas:150)["emergency"~"^lifeguard"];
)->.servicios;
.servicios out tags center;
`;

// Distancia máxima entre nuestro punto del censo y el polígono de playa de OSM
const DISTANCIA_PLAYA_M = 100;
// Distancia máxima entre un servicio y la playa
const DISTANCIA_SERVICIO_M = 150;

export function prepararDatosOsm(elementos: ElementoOsm[]) {
  const playas = elementos
    .filter((e) => e.tags?.natural === "beach")
    .flatMap((e) => {
      const geometria = geometriaPlaya(e);
      return geometria
        ? [{ id: `${e.type}/${e.id}`, geometria, ...serviciosDeEtiquetas(e.tags ?? {}) }]
        : [];
    });

  const servicios = elementos.flatMap((e) => {
    const tipo = tipoDeServicio(e.tags ?? {});
    const punto = puntoDeServicio(e);
    return tipo && punto ? [{ tipo, ...punto }] : [];
  });

  return { playas, servicios };
}

// Recalcula desde cero los datos de OSM (socorrista, perros, aseos, duchas) de todas las
// playas. No toca los de ITREM.
export async function importarServiciosOsm(db: Db, datos: ReturnType<typeof prepararDatosOsm>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      CREATE TEMP TABLE osm_playas ON COMMIT DROP AS
      SELECT x->>'id' AS id,
             (x->>'socorrista')::boolean AS socorrista,
             (x->>'perros')::boolean AS perros,
             (x->>'aseos')::boolean AS aseos,
             (x->>'duchas')::boolean AS duchas,
             -- Las relaciones llegan como líneas exteriores: ST_BuildArea reconstruye el área
             CASE WHEN x->'geometria'->>'type' = 'MultiLineString'
                  THEN ST_BuildArea(ST_GeomFromGeoJSON(x->'geometria'))
                  ELSE ST_MakeValid(ST_GeomFromGeoJSON(x->'geometria')) END AS geom
      FROM jsonb_array_elements(${JSON.stringify(datos.playas)}::jsonb) x
    `);
    await tx.execute(sql`
      CREATE TEMP TABLE osm_servicios ON COMMIT DROP AS
      SELECT x->>'tipo' AS tipo,
             ST_SetSRID(ST_MakePoint((x->>'lon')::float8, (x->>'lat')::float8), 4326) AS geom
      FROM jsonb_array_elements(${JSON.stringify(datos.servicios)}::jsonb) x
    `);

    // Los datos de OSM se recalculan siempre desde cero
    await tx.execute(sql`
      UPDATE playa_servicios
      SET socorrista = NULL, perros = NULL, aseos = NULL, duchas = NULL,
          fuentes = array_remove(fuentes, 'osm')
      WHERE 'osm' = ANY(fuentes)
    `);

    const filas = await tx.execute<{ playa_id: number }>(sql`
      WITH referencia AS (
        -- Para cada playa: los polígonos de OSM que la tocan y sus etiquetas
        SELECT p.id AS playa_id,
               COALESCE(ST_Union(o.geom), p.ubicacion) AS geom,
               bool_or(o.socorrista) AS socorrista,
               bool_or(o.perros) AS perros,
               bool_or(o.aseos) AS aseos,
               bool_or(o.duchas) AS duchas
        FROM playas p
        LEFT JOIN osm_playas o
          ON o.geom IS NOT NULL
         AND ST_DWithin(o.geom::geography, p.ubicacion::geography, ${DISTANCIA_PLAYA_M})
        GROUP BY p.id, p.ubicacion
      ),
      cercanos AS (
        -- Servicios a menos de 150 m de la playa (o de su punto, si no hay polígono)
        SELECT r.playa_id, s.tipo
        FROM referencia r
        JOIN osm_servicios s ON ST_DWithin(s.geom::geography, r.geom::geography, ${DISTANCIA_SERVICIO_M})
      ),
      resultado AS (
        -- La etiqueta de la playa manda; si no hay, basta un servicio cercano para el true
        SELECT r.playa_id,
               COALESCE(r.socorrista, bool_or(c.tipo = 'socorrista') FILTER (WHERE c.tipo = 'socorrista')) AS socorrista,
               r.perros,
               COALESCE(r.aseos, bool_or(c.tipo = 'aseos') FILTER (WHERE c.tipo = 'aseos')) AS aseos,
               COALESCE(r.duchas, bool_or(c.tipo = 'duchas') FILTER (WHERE c.tipo = 'duchas')) AS duchas
        FROM referencia r
        LEFT JOIN cercanos c ON c.playa_id = r.playa_id
        GROUP BY r.playa_id, r.socorrista, r.perros, r.aseos, r.duchas
      )
      INSERT INTO playa_servicios (playa_id, socorrista, perros, aseos, duchas, fuentes)
      SELECT playa_id, socorrista, perros, aseos, duchas, ARRAY['osm']
      FROM resultado
      WHERE socorrista IS NOT NULL OR perros IS NOT NULL OR aseos IS NOT NULL OR duchas IS NOT NULL
      ON CONFLICT (playa_id) DO UPDATE SET
        socorrista = excluded.socorrista,
        perros = excluded.perros,
        aseos = excluded.aseos,
        duchas = excluded.duchas,
        fuentes = CASE WHEN 'osm' = ANY(playa_servicios.fuentes) THEN playa_servicios.fuentes
                       ELSE array_append(playa_servicios.fuentes, 'osm') END,
        actualizado_en = now()
      RETURNING playa_id
    `);

    // Filas que se quedaron sin ninguna fuente (solo tenían datos de OSM y ya no)
    await tx.execute(sql`DELETE FROM playa_servicios WHERE fuentes = '{}'`);

    return { playasConDatos: filas.length };
  });
}
