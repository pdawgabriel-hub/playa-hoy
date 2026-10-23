import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";

import { estaciones } from "./estaciones.ts";

// Datos medidos por hora. Mismas variables y unidades que previsiones, para compararlas
// columna a columna al medir la fiabilidad.
export const observaciones = pgTable(
  "observaciones",
  {
    estacionId: text()
      .notNull()
      .references(() => estaciones.id, { onDelete: "cascade" }),
    hora: timestamp({ withTimezone: true }).notNull(),

    // Viento: velocidad y racha en km/h (AEMET da m/s: se convierte al guardar),
    // dirección de la que viene en grados
    vientoVelocidad: real(),
    vientoDireccion: real(),
    vientoRacha: real(),
    // °C
    temperaturaAire: real(),

    // Solo boyas: altura significativa en m, dirección de la que viene en grados, periodo en s
    olaAltura: real(),
    olaDireccion: real(),
    olaPeriodo: real(),
    // °C
    temperaturaAgua: real(),
  },
  (t) => [
    primaryKey({ columns: [t.estacionId, t.hora] }),
    check("observaciones_viento_direccion", sql`${t.vientoDireccion} BETWEEN 0 AND 360`),
    check("observaciones_ola_direccion", sql`${t.olaDireccion} BETWEEN 0 AND 360`),
    check(
      "observaciones_no_negativos",
      sql`${t.vientoVelocidad} >= 0 AND ${t.vientoRacha} >= 0 AND ${t.olaAltura} >= 0 AND ${t.olaPeriodo} >= 0`,
    ),
  ],
);
