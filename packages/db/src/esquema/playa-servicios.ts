import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { playas } from "./playas.ts";

// Servicios y características de cada playa, de ITREM (Turismo de la Región de Murcia) y
// OpenStreetMap. Cada dato admite tres valores: true o un valor (consta), false (consta que
// no) y null (no se sabe). "No consta" no es "no tiene".
export const playaServicios = pgTable(
  "playa_servicios",
  {
    playaId: integer()
      .primaryKey()
      .references(() => playas.id, { onDelete: "cascade" }),
    // Socorrismo en temporada de baño, no todo el año
    socorrista: boolean(),
    perros: boolean(),
    accesible: boolean(),
    aseos: boolean(),
    duchas: boolean(),
    nudista: boolean(),
    // Material dominante de la playa
    suelo: text(),
    // Afluencia habitual en temporada
    ocupacion: text(),
    // De dónde salen los datos de la fila: una playa puede combinar varias fuentes
    fuentes: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // timestamptz: se guarda en UTC
    actualizadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("playa_servicios_fuentes", sql`${t.fuentes} <@ ARRAY['itrem', 'osm', 'manual']`),
    check(
      "playa_servicios_suelo",
      sql`${t.suelo} IN ('arena_fina', 'arena', 'arena_y_grava', 'grava', 'bolos', 'roca')`,
    ),
    check("playa_servicios_ocupacion", sql`${t.ocupacion} IN ('baja', 'media', 'alta')`),
  ],
);
