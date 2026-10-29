// Partes comunes de los clientes de AEMET OpenData.
// https://opendata.aemet.es/ — uso autorizado citando a AEMET como autora.
import { z } from "zod";

import { ErrorRed, type OpcionesRed, pedirJson } from "../red.ts";

const API_AEMET = "https://opendata.aemet.es/opendata/api";
const CODIFICACION = "iso-8859-15";

export type OpcionesAemet = OpcionesRed & {
  // Pausa entre consultas, para no acercarse al límite de unas 40 peticiones por minuto
  pausaMs?: number;
};

// La API no da los datos directamente: devuelve un "sobre" con una URL temporal
const esquemaSobre = z.object({
  estado: z.number(),
  descripcion: z.string(),
  datos: z.string().optional(),
});

// La clave va en la cabecera, nunca en la URL, para que no acabe en ningún registro
export async function pedirAemet(ruta: string, clave: string, red: OpcionesRed): Promise<unknown> {
  const sobre = esquemaSobre.parse(
    await pedirJson(`${API_AEMET}${ruta}`, {
      ...red,
      cabeceras: { api_key: clave },
      codificacion: CODIFICACION,
    }),
  );
  if (sobre.estado !== 200 || !sobre.datos) {
    throw new Error(`AEMET ${ruta}: ${sobre.estado} ${sobre.descripcion}`);
  }
  return pedirJson(sobre.datos, { ...red, codificacion: CODIFICACION });
}

// Consulta una lista de códigos (playas, estaciones) uno detrás de otro, con una pausa: cada
// consulta son dos peticiones. Si una falla (después de sus reintentos), se apunta el error y
// se sigue con las demás. Salvo si la clave no vale (401 o 403): fallarían todas, así que se
// para en la primera.
export async function consultarUnoAUno<T>(
  codigos: string[],
  consultar: (codigo: string) => Promise<T>,
  { que, pausaMs = 1500 }: { que: string; pausaMs?: number | undefined },
) {
  const resultados = new Map<string, T>();
  const errores: string[] = [];
  for (const [i, codigo] of codigos.entries()) {
    if (i > 0) await new Promise((resolver) => setTimeout(resolver, pausaMs));
    try {
      resultados.set(codigo, await consultar(codigo));
    } catch (error) {
      if (error instanceof ErrorRed && (error.estado === 401 || error.estado === 403)) throw error;
      errores.push(`${que} ${codigo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { resultados, errores };
}
