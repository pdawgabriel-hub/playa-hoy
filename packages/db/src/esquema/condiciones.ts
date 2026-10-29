import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { playas } from "./playas.ts";

const enUtc = { withTimezone: true } as const;

// Lo que el motor deduce de la previsión para cada playa y hora: lo que pasa en la orilla,
// no mar adentro. Es de la playa, no de un plan. Como `notas`, solo guarda el cálculo
// vigente: cada cálculo sustituye al anterior.
export const condiciones = pgTable(
  "condiciones",
  {
    playaId: integer()
      .notNull()
      .references(() => playas.id, { onDelete: "cascade" }),
    hora: timestamp(enUtc).notNull(),
    // Ola en la orilla: altura significativa en m y periodo en s
    olaOrilla: real(),
    olaPeriodo: real(),
    // Cómo llega el viento: mar, lado, tierra o calma
    entradaViento: text().$type<"mar" | "lado" | "tierra" | "calma">(),
    // De 1 (agua quieta) a 0, y su estado: cristalina, buena o turbia
    claridad: real(),
    estadoAgua: text().$type<"cristalina" | "buena" | "turbia">(),
    // La temperatura del agua usada y de dónde sale: en el Mar Menor, de AEMET si la hay
    temperaturaAgua: real(),
    fuenteTemperaturaAgua: text().$type<"open_meteo" | "aemet">(),
    // Bandera probable (una estimación: la iza el socorrista)
    bandera: text().$type<"verde" | "amarilla" | "roja">(),
    // Emisión de la previsión de la que sale
    emitidaEn: timestamp(enUtc).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.playaId, t.hora] }),
    index("condiciones_hora_idx").on(t.hora),
    check(
      "condiciones_entrada_viento",
      sql`${t.entradaViento} IN ('mar', 'lado', 'tierra', 'calma')`,
    ),
    check("condiciones_claridad", sql`${t.claridad} BETWEEN 0 AND 1`),
    check("condiciones_estado_agua", sql`${t.estadoAgua} IN ('cristalina', 'buena', 'turbia')`),
    check(
      "condiciones_fuente_temperatura_agua",
      sql`${t.fuenteTemperaturaAgua} IN ('open_meteo', 'aemet')`,
    ),
    check("condiciones_bandera", sql`${t.bandera} IN ('verde', 'amarilla', 'roja')`),
    check("condiciones_no_negativos", sql`${t.olaOrilla} >= 0 AND ${t.olaPeriodo} >= 0`),
  ],
);
