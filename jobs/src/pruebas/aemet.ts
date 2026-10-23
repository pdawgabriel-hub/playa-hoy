// AEMET OpenData simulada con MSW, con sus dos pasos: el "sobre" con una URL temporal y los
// datos en esa URL, en ISO-8859-15. Responde con la predicción real de Manzanares
// (23/10/2026) para cualquier playa.
import { readFileSync } from "node:fs";

import { HttpResponse, http } from "msw";

import { redSimulada } from "./red.ts";

const API = "https://opendata.aemet.es/opendata/api/prediccion/especifica/playa/:codigo";
const TEMPORAL = "https://opendata.aemet.es/opendata/sh/:codigo";

export const PREDICCION_MANZANARES = readFileSync(
  new URL("../aemet/pruebas/playa-3090206.json", import.meta.url),
);

type Opciones = {
  // Si se indica, cualquier otra clave recibe un 401
  clave?: string;
  // Playas de las que AEMET dice que no tiene datos (estado 404 dentro del sobre)
  sinDatos?: string[];
  // Playas cuya petición falla con un 500
  caidas?: string[];
};

// Devuelve las peticiones recibidas, con la URL y la clave de cada una
export function simularAemet({ clave, sinDatos = [], caidas = [] }: Opciones = {}) {
  const peticiones: { url: string; clave: string | null }[] = [];
  redSimulada.use(
    http.get(API, ({ request, params }) => {
      const recibida = request.headers.get("api_key");
      peticiones.push({ url: request.url, clave: recibida });
      const codigo = String(params.codigo);
      if (clave !== undefined && recibida !== clave) return new HttpResponse(null, { status: 401 });
      if (caidas.includes(codigo)) return new HttpResponse(null, { status: 500 });
      const estado = sinDatos.includes(codigo) ? 404 : 200;
      return HttpResponse.json({
        descripcion: estado === 200 ? "exito" : "No hay datos",
        estado,
        datos: `https://opendata.aemet.es/opendata/sh/${codigo}`,
      });
    }),
    http.get(
      TEMPORAL,
      () =>
        new HttpResponse(PREDICCION_MANZANARES, {
          headers: { "Content-Type": "text/plain;charset=ISO-8859-15" },
        }),
    ),
  );
  return peticiones;
}
