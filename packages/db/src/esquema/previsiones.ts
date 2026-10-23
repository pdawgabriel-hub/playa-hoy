import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, real, timestamp } from "drizzle-orm/pg-core";

import { puntosConsulta } from "./puntos-consulta.ts";

const enUtc = { withTimezone: true } as const;

// Previsión por horas de cada punto de consulta. Se guardan todas las emisiones, no solo
// la última: la misma hora aparece una vez por cada emisión que la predijo, y así se puede
// medir cómo cambia la previsión según la antelación.
export const previsiones = pgTable(
  "previsiones",
  {
    puntoId: integer()
      .notNull()
      .references(() => puntosConsulta.id, { onDelete: "cascade" }),
    // Momento de la descarga
    emitidaEn: timestamp(enUtc).notNull(),
    // Hora a la que se refiere la previsión
    hora: timestamp(enUtc).notNull(),

    // Viento a 10 m: velocidad y racha en km/h, dirección de la que viene en grados
    vientoVelocidad: real(),
    vientoDireccion: real(),
    vientoRacha: real(),
    // °C
    temperaturaAire: real(),
    // % de cielo cubierto
    nubosidad: real(),

    // Oleaje mar adentro: altura significativa en m, dirección de la que viene en grados,
    // periodo en s. Nulo más allá del horizonte del modelo marino (unos 10 días).
    olaAltura: real(),
    olaDireccion: real(),
    olaPeriodo: real(),
    // °C
    temperaturaAgua: real(),
  },
  (t) => [
    primaryKey({ columns: [t.puntoId, t.emitidaEn, t.hora] }),
    // Comparar previsto y medido a una hora
    index("previsiones_hora_idx").on(t.hora),
    // Última emisión y borrado de emisiones antiguas
    index("previsiones_emitida_en_idx").on(t.emitidaEn),
    check("previsiones_viento_direccion", sql`${t.vientoDireccion} BETWEEN 0 AND 360`),
    check("previsiones_ola_direccion", sql`${t.olaDireccion} BETWEEN 0 AND 360`),
    check("previsiones_nubosidad", sql`${t.nubosidad} BETWEEN 0 AND 100`),
    // Solo se guardan horas futuras a la emisión: la retención se queda con la última
    // emisión de cada hora, que así es siempre una previsión y no algo ya pasado
    check("previsiones_hora_tras_emision", sql`${t.hora} >= ${t.emitidaEn}`),
    check(
      "previsiones_no_negativos",
      sql`${t.vientoVelocidad} >= 0 AND ${t.vientoRacha} >= 0 AND ${t.olaAltura} >= 0 AND ${t.olaPeriodo} >= 0`,
    ),
  ],
);
