import { sql } from "drizzle-orm";
import { check, pgTable, real, text } from "drizzle-orm/pg-core";

import { puntoWgs84 } from "../geo.ts";

// Estaciones y boyas que miden de verdad. La clave es el código oficial de cada fuente
// (AEMET: "7019X"; Puertos del Estado: "6100417").
export const estaciones = pgTable(
  "estaciones",
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    ubicacion: puntoWgs84().notNull(),
    // Metros sobre el nivel del mar
    altitud: real(),
    fuente: text().notNull(),
  },
  (t) => [check("estaciones_fuente", sql`${t.fuente} IN ('aemet', 'puertos_estado')`)],
);
