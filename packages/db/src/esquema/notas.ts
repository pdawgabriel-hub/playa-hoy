import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { playas } from "./playas.ts";

const enUtc = { withTimezone: true } as const;

// Nota de 0 a 100 de cada playa según el plan, por horas. Se calcula tras cada ingesta y
// sustituye a la anterior: aquí solo está la nota vigente, no una por emisión.
export const notas = pgTable(
  "notas",
  {
    playaId: integer()
      .notNull()
      .references(() => playas.id, { onDelete: "cascade" }),
    perfil: text().notNull(),
    hora: timestamp(enUtc).notNull(),
    nota: smallint().notNull(),
    // Explicación en lenguaje claro, con su tipo para mostrarla: a favor ("Poca ola en la
    // orilla (0,1 m)"), en contra o lo que descarta la playa
    razones: jsonb()
      .$type<{ tipo: "descarta" | "en_contra" | "a_favor"; factor: string; texto: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Emisión de la previsión de la que sale la nota
    emitidaEn: timestamp(enUtc).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.playaId, t.perfil, t.hora] }),
    // Ranking: mejores playas para un plan a una hora, ya ordenadas por nota
    index("notas_ranking_idx").on(t.perfil, t.hora, t.nota.desc()),
    check("notas_perfil", sql`${t.perfil} IN ('familia', 'snorkel', 'sol', 'surf')`),
    check("notas_nota", sql`${t.nota} BETWEEN 0 AND 100`),
  ],
);
