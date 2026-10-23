import { index, integer, pgTable } from "drizzle-orm/pg-core";

import { puntoWgs84 } from "../geo.ts";

// Coordenadas que se piden a las APIs de previsión. Varias playas cercanas comparten la
// misma celda del modelo, así que la previsión se guarda una vez por punto y no por playa.
export const puntosConsulta = pgTable(
  "puntos_consulta",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ubicacion: puntoWgs84().notNull().unique("puntos_consulta_ubicacion_unique"),
  },
  // Punto más cercano a cada playa
  (t) => [index("puntos_consulta_ubicacion_idx").using("gist", t.ubicacion)],
);
