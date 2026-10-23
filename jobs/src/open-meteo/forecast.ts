// Cliente de Open-Meteo Forecast: viento, temperatura del aire y nubes por horas.
// https://open-meteo.com/en/docs
// Datos con licencia CC BY 4.0: hay que citar a Open-Meteo.
//
// Cada variable se pide a la celda que mejor acierta en la costa, comparando con lo medido
// por las estaciones de AEMET (fase 4): el viento, a la celda de mar (cell_selection=sea),
// porque es el que llega a la playa; la temperatura y las nubes, a la de tierra.
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

const URL_FORECAST = "https://api.open-meteo.com/v1/forecast";

const PETICIONES = {
  viento: { celda: "sea", variables: ["wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"] },
  tiempo: { celda: "land", variables: ["temperature_2m", "cloud_cover"] },
} as const;

export type HoraTiempo = {
  hora: Date;
  vientoVelocidad: number | null;
  vientoDireccion: number | null;
  vientoRacha: number | null;
  temperaturaAire: number | null;
  nubosidad: number | null;
};

export type PrevisionTiempo = {
  // Celdas del modelo a las que la API ajusta el punto pedido
  celdaViento: Coordenadas;
  celdaTiempo: Coordenadas;
  horas: HoraTiempo[];
};

const cabecera = { latitude: z.number(), longitude: z.number(), utc_offset_seconds: z.literal(0) };
const esquemaViento = z.object({
  ...cabecera,
  hourly: z.object({
    time: z.array(z.number()),
    wind_speed_10m: serie,
    wind_direction_10m: serie,
    wind_gusts_10m: serie,
  }),
});
const esquemaTiempo = z.object({
  ...cabecera,
  hourly: z.object({ time: z.array(z.number()), temperature_2m: serie, cloud_cover: serie }),
});

export function urlForecast(
  puntos: Coordenadas[],
  peticion: keyof typeof PETICIONES,
  dias = DIAS_PREVISION,
): string {
  const { celda, variables } = PETICIONES[peticion];
  const parametros = new URLSearchParams({
    ...parametrosBase(puntos, dias),
    hourly: variables.join(","),
    cell_selection: celda,
    wind_speed_unit: "kmh",
  });
  return `${URL_FORECAST}?${parametros.toString()}`;
}

// Combina las dos respuestas (viento y tiempo) hora a hora
export function leerRespuestaForecast(
  datosViento: unknown,
  datosTiempo: unknown,
  puntosPedidos: number,
): PrevisionTiempo[] {
  const viento = comoLista(
    esquemaViento,
    datosViento,
    puntosPedidos,
    "Open-Meteo Forecast (viento)",
  );
  const tiempo = comoLista(
    esquemaTiempo,
    datosTiempo,
    puntosPedidos,
    "Open-Meteo Forecast (tiempo)",
  );

  return viento.map((v, i) => {
    const t = tiempo[i];
    if (!t || t.hourly.time.join() !== v.hourly.time.join()) {
      throw new Error(
        `Open-Meteo Forecast: las horas del viento y del tiempo no coinciden en el punto ${i}`,
      );
    }
    return {
      celdaViento: { lat: v.latitude, lon: v.longitude },
      celdaTiempo: { lat: t.latitude, lon: t.longitude },
      horas: v.hourly.time.map((segundos, h) => ({
        hora: new Date(segundos * 1000),
        vientoVelocidad: v.hourly.wind_speed_10m[h] ?? null,
        vientoDireccion: v.hourly.wind_direction_10m[h] ?? null,
        vientoRacha: v.hourly.wind_gusts_10m[h] ?? null,
        temperaturaAire: t.hourly.temperature_2m[h] ?? null,
        nubosidad: t.hourly.cloud_cover[h] ?? null,
      })),
    };
  });
}

export async function consultarForecast(
  puntos: Coordenadas[],
  opciones: OpcionesRed & { dias?: number } = {},
): Promise<PrevisionTiempo[]> {
  const resultado: PrevisionTiempo[] = [];
  for (let i = 0; i < puntos.length; i += PUNTOS_POR_PETICION) {
    const grupo = puntos.slice(i, i + PUNTOS_POR_PETICION);
    const [viento, tiempo] = await Promise.all([
      pedirJson(urlForecast(grupo, "viento", opciones.dias), opciones),
      pedirJson(urlForecast(grupo, "tiempo", opciones.dias), opciones),
    ]);
    resultado.push(...leerRespuestaForecast(viento, tiempo, grupo.length));
  }
  return resultado;
}
