import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { lineaWgs84 } from "../geo.ts";

// Línea de costa de OpenStreetMap (natural=coastline), por tramos. Incluye la orilla del
// Mar Menor. En OSM la costa se dibuja con la tierra a la izquierda y el mar a la derecha,
// así que el orden de los puntos dice hacia dónde está el mar.
export const costa = pgTable(
  "costa",
  {
    // Identificador del tramo en OSM: "way/123456"
    id: text().primaryKey(),
    linea: lineaWgs84().notNull(),
    descargadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // Tramos de costa cercanos a cada playa
  (t) => [index("costa_linea_idx").using("gist", t.linea)],
);
