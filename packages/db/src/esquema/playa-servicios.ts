import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { playas } from "./playas.ts";

// Servicios de cada playa, de OpenStreetMap. Cada servicio admite tres valores:
// true (lo tiene), false (consta que no) y null (no se sabe). "No consta" no es "no tiene".
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
    fuente: text().notNull(),
    // timestamptz: se guarda en UTC
    actualizadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("playa_servicios_fuente", sql`${t.fuente} IN ('osm', 'manual')`)],
);
