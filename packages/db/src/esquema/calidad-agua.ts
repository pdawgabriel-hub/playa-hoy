import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { playas } from "./playas.ts";

// Calificación oficial de cada zona de baño por temporada (Directiva 2006/7/CE), de la
// Agencia Europea de Medio Ambiente. Se cruza con las playas por el código del censo.
// Sin datos de una temporada: no hay fila.
export const calidadAgua = pgTable(
  "calidad_agua",
  {
    playaId: integer()
      .notNull()
      .references(() => playas.id, { onDelete: "cascade" }),
    temporada: integer().notNull(),
    calificacion: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.playaId, t.temporada] }),
    check(
      "calidad_agua_calificacion",
      sql`${t.calificacion} IN ('excelente', 'buena', 'suficiente', 'insuficiente', 'sin_clasificar')`,
    ),
    // En España la clasificación actual se aplica desde 2011. Antes era otra escala
    // ("buena o suficiente" juntas) que no encaja en estas clases.
    check("calidad_agua_temporada", sql`${t.temporada} >= 2011`),
  ],
);
