import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, primaryKey, real, timestamp } from "drizzle-orm/pg-core";

import { playas } from "./playas.ts";

// Predicción diaria de AEMET para las playas que tienen código de AEMET. Sirve sobre todo
// para la temperatura del agua del Mar Menor, que Open-Meteo no da. Se guarda solo la
// última predicción de cada día: unas 10.000 filas al año.
export const previsionesAemet = pgTable(
  "previsiones_aemet",
  {
    playaId: integer()
      .notNull()
      .references(() => playas.id, { onDelete: "cascade" }),
    // Día al que se refiere, en hora de España: es un día del calendario, no un instante
    fecha: date({ mode: "string" }).notNull(),
    // Cuándo la elaboró AEMET, en UTC
    elaboradaEn: timestamp({ withTimezone: true }).notNull(),
    // °C, en grados enteros
    temperaturaAgua: real(),
    temperaturaMaxima: real(),
    uvMaximo: real(),
  },
  (t) => [
    primaryKey({ columns: [t.playaId, t.fecha] }),
    check("previsiones_aemet_uv", sql`${t.uvMaximo} >= 0`),
  ],
);
