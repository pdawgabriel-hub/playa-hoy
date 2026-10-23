// Cliente de Open-Meteo Marine: oleaje y temperatura del agua por horas.
// https://open-meteo.com/en/docs/marine-weather-api
// Datos con licencia CC BY 4.0: hay que citar a Open-Meteo.
import { z } from "zod";

import { type OpcionesRed, pedirJson } from "../red.ts";

const URL_MARINE = "https://marine-api.open-meteo.com/v1/marine";

// Variables que se piden a Open-Meteo
const VARIABLES = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "sea_surface_temperature",
] as const;

// Más allá de unos 10 días el modelo marino no da datos (comprobado en la fase 0)
export const DIAS_MARINE = 10;

export type Coordenadas = { lat: number; lon: number };

export type HoraMarina = {
  hora: Date;
  olaAltura: number | null;
  olaDireccion: number | null;
  olaPeriodo: number | null;
  temperaturaAgua: number | null;
};

export type PrevisionMarina = {
  // Celda del modelo a la que la API ajusta el punto pedido (malla de unos 9 km)
  celda: Coordenadas;
  horas: HoraMarina[];
};

const serie = z.array(z.number().nullable());
const esquemaPunto = z.object({
  latitude: z.number(),
  longitude: z.number(),
  // Se pide en UTC: cualquier otro desfase es un error de la petición
  utc_offset_seconds: z.literal(0),
  hourly: z.object({
    time: z.array(z.number()),
    wave_height: serie,
    wave_direction: serie,
    wave_period: serie,
    sea_surface_temperature: serie,
  }),
});

export function urlMarine(puntos: Coordenadas[], dias = DIAS_MARINE): string {
  const parametros = new URLSearchParams({
    latitude: puntos.map((p) => p.lat).join(","),
    longitude: puntos.map((p) => p.lon).join(","),
    hourly: VARIABLES.join(","),
    forecast_days: String(dias),
    timezone: "GMT",
    // Segundos desde 1970: sin ambigüedad de zona horaria
    timeformat: "unixtime",
  });
  return `${URL_MARINE}?${parametros.toString()}`;
}

// Con un punto, la API devuelve un objeto; con varios, una lista en el mismo orden
export function leerRespuestaMarine(datos: unknown, puntosPedidos: number): PrevisionMarina[] {
  const lista = z.array(esquemaPunto).parse(Array.isArray(datos) ? datos : [datos]);
  if (lista.length !== puntosPedidos) {
    throw new Error(
      `Open-Meteo Marine devolvió ${lista.length} puntos y se pidieron ${puntosPedidos}`,
    );
  }

  return lista.map(({ latitude, longitude, hourly }) => {
    const total = hourly.time.length;
    for (const variable of VARIABLES) {
      if (hourly[variable].length !== total) {
        throw new Error(
          `Open-Meteo Marine: ${variable} tiene ${hourly[variable].length} valores y hay ${total} horas`,
        );
      }
    }
    return {
      celda: { lat: latitude, lon: longitude },
      horas: hourly.time.map((segundos, i) => ({
        hora: new Date(segundos * 1000),
        olaAltura: hourly.wave_height[i] ?? null,
        olaDireccion: hourly.wave_direction[i] ?? null,
        olaPeriodo: hourly.wave_period[i] ?? null,
        temperaturaAgua: hourly.sea_surface_temperature[i] ?? null,
      })),
    };
  });
}

// Open-Meteo admite muchas coordenadas por petición; se agrupan de 50 en 50
const PUNTOS_POR_PETICION = 50;

export async function consultarMarine(
  puntos: Coordenadas[],
  opciones: OpcionesRed & { dias?: number } = {},
): Promise<PrevisionMarina[]> {
  const resultado: PrevisionMarina[] = [];
  for (let i = 0; i < puntos.length; i += PUNTOS_POR_PETICION) {
    const grupo = puntos.slice(i, i + PUNTOS_POR_PETICION);
    resultado.push(
      ...leerRespuestaMarine(
        await pedirJson(urlMarine(grupo, opciones.dias), opciones),
        grupo.length,
      ),
    );
  }
  return resultado;
}
