// Agrupa las playas que caen en las mismas celdas del modelo de Open-Meteo en puntos de
// consulta: pnpm --filter @playa-hoy/jobs calcular:puntos
// Hay que repetirlo cuando cambie el catálogo de playas.
import { crearDb, esquema } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { consultarForecast } from "./open-meteo/forecast.ts";
import { consultarMarine } from "./open-meteo/marine.ts";
import { agruparPorCeldas, importarPuntosConsulta } from "./puntos-consulta.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const playas = await db
    .select({ id: esquema.playas.id, ubicacion: esquema.playas.ubicacion })
    .from(esquema.playas);
  const coordenadas = playas.map((p) => ({ lat: p.ubicacion.y, lon: p.ubicacion.x }));

  // Un solo día: solo interesa en qué celdas cae cada playa
  const [marina, tiempo] = await Promise.all([
    consultarMarine(coordenadas, { dias: 1 }),
    consultarForecast(coordenadas, { dias: 1 }),
  ]);

  const grupos = agruparPorCeldas(
    playas.map((playa, i) => {
      const m = marina[i];
      const t = tiempo[i];
      if (!m || !t) throw new Error(`Falta la previsión de la playa ${playa.id}`);
      return {
        id: playa.id,
        ubicacion: coordenadas[i] ?? { lat: 0, lon: 0 },
        celdaMarina: m.celda,
        celdaViento: t.celdaViento,
        celdaTiempo: t.celdaTiempo,
      };
    }),
  );
  const { puntos, playas: enlazadas, borrados } = await importarPuntosConsulta(db, grupos);
  console.log(
    `Puntos de consulta: ${puntos} para ${enlazadas} playas${borrados ? ` (${borrados} borrados sin playas)` : ""}`,
  );
} finally {
  await cerrar();
}
