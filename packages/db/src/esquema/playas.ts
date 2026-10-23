import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, real, text } from "drizzle-orm/pg-core";

import { puntoWgs84 } from "../geo.ts";
import { condicionSlug } from "./comun.ts";
import { municipios } from "./municipios.ts";
import { zonas } from "./zonas.ts";

export const playas = pgTable(
  "playas",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombre: text().notNull(),
    slug: text().notNull().unique(),
    municipioId: text()
      .notNull()
      .references(() => municipios.id),
    // Las zonas se definen después de importar las playas
    zonaId: integer().references(() => zonas.id),
    ubicacion: puntoWgs84().notNull(),
    // Hacia dónde mira la playa, en grados (0 = norte, 90 = este). Null hasta calcularla:
    // 0 significaría que mira al norte.
    mira: real(),
    // Protección de cabos, bahías o puertos: 0 = expuesta, 1 = totalmente abrigada.
    abrigo: real(),
    // Playas del Mar Menor: sin oleaje del Mediterráneo
    laguna: boolean().notNull().default(false),
    // Códigos de origen. Reimportar una fuente actualiza la playa en lugar de duplicarla.
    codigoCenso: text().unique("playas_codigo_censo_unique"),
    codigoAemet: text().unique("playas_codigo_aemet_unique"),
    osmId: text().unique("playas_osm_id_unique"),
  },
  (t) => [
    check("playas_slug", condicionSlug(t.slug)),
    check("playas_mira", sql`${t.mira} >= 0 AND ${t.mira} < 360`),
    check("playas_abrigo", sql`${t.abrigo} BETWEEN 0 AND 1`),
    // Toda playa sale del censo o de OpenStreetMap: no se inventan playas
    check("playas_origen", sql`${t.codigoCenso} IS NOT NULL OR ${t.osmId} IS NOT NULL`),
    // Mapa: playas dentro de un recuadro
    index("playas_ubicacion_idx").using("gist", t.ubicacion),
    // Cercanía en metros: "las 10 playas más cercanas" sin calcular la distancia a todas
    index("playas_ubicacion_geography_idx").using("gist", sql`(${t.ubicacion}::geography)`),
    // Páginas de municipio y de zona (PostgreSQL no indexa las claves foráneas)
    index("playas_municipio_idx").on(t.municipioId),
    index("playas_zona_idx").on(t.zonaId),
  ],
);
