// AEMET OpenData simulada con MSW, con sus dos pasos: el "sobre" con una URL temporal y los
// datos en esa URL, en ISO-8859-15. Para cualquier playa responde con la predicción real de
// Manzanares (23/10/2026) y para cualquier estación con la observación real de Cabo de Palos
// (29/10/2026), con el código de la estación pedida.
import { readFileSync } from "node:fs";

import { HttpResponse, http } from "msw";

import observacion from "../aemet/pruebas/observacion-7019X.json" with { type: "json" };
import { redSimulada } from "./red.ts";

const AEMET = "https://opendata.aemet.es/opendata";

export const PREDICCION_MANZANARES = readFileSync(
  new URL("../aemet/pruebas/playa-3090206.json", import.meta.url),
);

type Opciones = {
  // Si se indica, cualquier otra clave recibe un 401
  clave?: string;
  // Playas o estaciones de las que AEMET dice que no tiene datos (estado 404 dentro del sobre)
  sinDatos?: string[];
  // Playas o estaciones cuya petición falla con un 500
  caidas?: string[];
};

const enIso = (cuerpo: Buffer | string) =>
  new HttpResponse(typeof cuerpo === "string" ? Buffer.from(cuerpo, "latin1") : cuerpo, {
    headers: { "Content-Type": "text/plain;charset=ISO-8859-15" },
  });

// Devuelve las peticiones recibidas, con la URL y la clave de cada una
export function simularAemet({ clave, sinDatos = [], caidas = [] }: Opciones = {}) {
  const peticiones: { url: string; clave: string | null }[] = [];

  // El sobre de una consulta: apunta a `temporal` con los datos
  const sobre = (ruta: string, temporal: (codigo: string) => string) =>
    http.get(`${AEMET}/api${ruta}`, ({ request, params }) => {
      const recibida = request.headers.get("api_key");
      peticiones.push({ url: request.url, clave: recibida });
      const codigo = String(params.codigo);
      if (clave !== undefined && recibida !== clave) return new HttpResponse(null, { status: 401 });
      if (caidas.includes(codigo)) return new HttpResponse(null, { status: 500 });
      const estado = sinDatos.includes(codigo) ? 404 : 200;
      return HttpResponse.json({
        descripcion: estado === 200 ? "exito" : "No hay datos",
        estado,
        datos: `${AEMET}/sh/${temporal(codigo)}`,
      });
    });

  redSimulada.use(
    sobre("/prediccion/especifica/playa/:codigo", (codigo) => `playa/${codigo}`),
    sobre("/observacion/convencional/datos/estacion/:codigo", (codigo) => `estacion/${codigo}`),
    http.get(`${AEMET}/sh/playa/:codigo`, () => enIso(PREDICCION_MANZANARES)),
    http.get(`${AEMET}/sh/estacion/:codigo`, ({ params }) =>
      enIso(
        JSON.stringify(observacion).replaceAll(
          '"idema":"7019X"',
          `"idema":"${String(params.codigo)}"`,
        ),
      ),
    ),
  );
  return peticiones;
}
