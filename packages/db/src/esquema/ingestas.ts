import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const enUtc = { withTimezone: true } as const;

// Registro de cada ejecución de la ingesta, una fila por fuente. Dice si los datos están al
// día y qué falló. Son unas pocas filas al día: no necesita retención.
export const ingestas = pgTable(
  "ingestas",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    fuente: text().notNull(),
    empezadaEn: timestamp(enUtc).notNull(),
    terminadaEn: timestamp(enUtc).notNull(),
    // ok: todo bien; parcial: se guardó algo pero hubo fallos; error: no se guardó nada
    estado: text().notNull(),
    filas: integer().notNull(),
    errores: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [
    check("ingestas_fuente", sql`${t.fuente} IN ('open_meteo', 'aemet', 'aemet_observaciones')`),
    check("ingestas_estado", sql`${t.estado} IN ('ok', 'parcial', 'error')`),
    check("ingestas_filas", sql`${t.filas} >= 0`),
    // Última ingesta de cada fuente
    index("ingestas_fuente_empezada_en_idx").on(t.fuente, t.empezadaEn.desc()),
  ],
);
