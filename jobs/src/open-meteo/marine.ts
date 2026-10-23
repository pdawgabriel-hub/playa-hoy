// Cliente de Open-Meteo Marine: oleaje y temperatura del agua por horas.
// https://open-meteo.com/en/docs/marine-weather-api
// Datos con licencia CC BY 4.0: hay que citar a Open-Meteo.
import { z } from "zod";

import { type OpcionesRed, pedirJson } from "../red.ts";
import {
  type Coordenadas,
  DIAS_PREVISION,
  PUNTOS_POR_PETICION,
  comoLista,
  parametrosBase,
  serie,
} from "./comun.ts";

const URL_MARINE = "https://marine-api.open-meteo.com/v1/marine";

// Variables que se piden a Open-Meteo
const VARIABLES = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "sea_surface_temperature",
] as const;

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

export function urlMarine(puntos: Coordenadas[], dias = DIAS_PREVISION): string {
  const parametros = new URLSearchParams({
    ...parametrosBase(puntos, dias),
    hourly: VARIABLES.join(","),
  });
  return `${URL_MARINE}?${parametros.toString()}`;
}

export function leerRespuestaMarine(datos: unknown, puntosPedidos: number): PrevisionMarina[] {
  return comoLista(esquemaPunto, datos, puntosPedidos, "Open-Meteo Marine").map(
    ({ latitude, longitude, hourly }) => ({
      celda: { lat: latitude, lon: longitude },
      horas: hourly.time.map((segundos, i) => ({
        hora: new Date(segundos * 1000),
        olaAltura: hourly.wave_height[i] ?? null,
        olaDireccion: hourly.wave_direction[i] ?? null,
        olaPeriodo: hourly.wave_period[i] ?? null,
        temperaturaAgua: hourly.sea_surface_temperature[i] ?? null,
      })),
    }),
  );
}

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
