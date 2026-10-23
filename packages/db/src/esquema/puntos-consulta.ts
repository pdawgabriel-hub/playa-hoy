import { index, integer, pgTable, text } from "drizzle-orm/pg-core";

import { puntoWgs84 } from "../geo.ts";

// Coordenadas que se piden a las APIs de previsión. Las playas que caen en las mismas celdas
// del modelo (oleaje, viento y temperatura) reciben exactamente la misma previsión, así que
// se guarda una vez por punto y no por playa.
export const puntosConsulta = pgTable(
  "puntos_consulta",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // La ubicación de una de sus playas: otro punto podría caer en otras celdas
    ubicacion: puntoWgs84().notNull().unique("puntos_consulta_ubicacion_unique"),
    // Las tres celdas del modelo que identifican el grupo ("lat,lon|lat,lon|lat,lon")
    celdas: text().notNull().unique("puntos_consulta_celdas_unique"),
  },
  // Punto más cercano a cada playa
  (t) => [index("puntos_consulta_ubicacion_idx").using("gist", t.ubicacion)],
);
