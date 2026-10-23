// Cliente de AEMET OpenData: predicción específica de playas.
// https://opendata.aemet.es/ — uso autorizado citando a AEMET como autora.
//
// De esta predicción solo interesa de verdad la temperatura del agua (sobre todo la del Mar
// Menor, que Open-Meteo no da): el viento y el oleaje vienen por categorías y sin dirección.
import { horaEspanaAUtc } from "@playa-hoy/shared";
import { z } from "zod";

import { type OpcionesRed, pedirJson } from "../red.ts";

const API_AEMET = "https://opendata.aemet.es/opendata/api";
const CODIFICACION = "iso-8859-15";

type OpcionesAemet = OpcionesRed & {
  // Para los tests: la API de AEMET en otro sitio
  base?: string;
  // Pausa entre playas, para no acercarse al límite de unas 40 peticiones por minuto
  pausaMs?: number;
};

// La API no da los datos directamente: devuelve un "sobre" con una URL temporal
const esquemaSobre = z.object({
  estado: z.number(),
  descripcion: z.string(),
  datos: z.string().optional(),
});

// La clave va en la cabecera, nunca en la URL, para que no acabe en ningún registro
async function pedirAemet(ruta: string, clave: string, opciones: OpcionesAemet): Promise<unknown> {
  const { base = API_AEMET, ...red } = opciones;
  const sobre = esquemaSobre.parse(
    await pedirJson(`${base}${ruta}`, {
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

// Mañana y tarde, por categorías ("flojo", "débil", "nuboso"...)
const esquemaDoble = z.object({ descripcion1: z.string(), descripcion2: z.string() });
const esquemaValor = z.object({ valor1: z.number() });

const esquemaPrediccion = z
  .array(
    z.object({
      nombre: z.string(),
      // Hora oficial de España, sin zona horaria
      elaborado: z.string(),
      prediccion: z.object({
        dia: z.array(
          z.object({
            // 20261023
            fecha: z.number(),
            estadoCielo: esquemaDoble,
            viento: esquemaDoble,
            oleaje: esquemaDoble,
            tMaxima: esquemaValor,
            tAgua: esquemaValor,
            uvMax: esquemaValor,
          }),
        ),
      }),
    }),
  )
  .length(1);

export type MananaYTarde = { manana: string; tarde: string };

export type DiaPlayaAemet = {
  // "2026-10-23"
  fecha: string;
  // °C, en grados enteros
  temperaturaAgua: number;
  temperaturaMaxima: number;
  uvMaximo: number;
  cielo: MananaYTarde;
  viento: MananaYTarde;
  oleaje: MananaYTarde;
};

export type PrediccionPlayaAemet = {
  nombre: string;
  // En UTC
  elaborado: Date;
  dias: DiaPlayaAemet[];
};

const mananaYTarde = ({
  descripcion1,
  descripcion2,
}: z.infer<typeof esquemaDoble>): MananaYTarde => ({
  manana: descripcion1,
  tarde: descripcion2,
});

export function leerPrediccionPlaya(datos: unknown): PrediccionPlayaAemet {
  const [playa] = esquemaPrediccion.parse(datos);
  if (!playa) throw new Error("AEMET no devolvió ninguna playa");

  return {
    nombre: playa.nombre,
    elaborado: horaEspanaAUtc(playa.elaborado),
    dias: playa.prediccion.dia.map((dia) => {
      const f = String(dia.fecha);
      return {
        fecha: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`,
        temperaturaAgua: dia.tAgua.valor1,
        temperaturaMaxima: dia.tMaxima.valor1,
        uvMaximo: dia.uvMax.valor1,
        cielo: mananaYTarde(dia.estadoCielo),
        viento: mananaYTarde(dia.viento),
        oleaje: mananaYTarde(dia.oleaje),
      };
    }),
  };
}

// `codigo`: el de la playa en AEMET (7 dígitos, por ejemplo 3090206)
export async function consultarPlayaAemet(
  codigo: string,
  clave: string,
  opciones: OpcionesAemet = {},
) {
  return leerPrediccionPlaya(
    await pedirAemet(`/prediccion/especifica/playa/${codigo}`, clave, opciones),
  );
}

// Una playa detrás de otra, con una pausa: cada playa son dos peticiones
export async function consultarPlayasAemet(
  codigos: string[],
  clave: string,
  opciones: OpcionesAemet = {},
) {
  const { pausaMs = 1500 } = opciones;
  const resultado = new Map<string, PrediccionPlayaAemet>();
  for (const [i, codigo] of codigos.entries()) {
    if (i > 0) await new Promise((resolver) => setTimeout(resolver, pausaMs));
    resultado.set(codigo, await consultarPlayaAemet(codigo, clave, opciones));
  }
  return resultado;
}
