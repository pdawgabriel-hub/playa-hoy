// Partes comunes de los clientes de Open-Meteo
import { z } from "zod";

export type Coordenadas = { lat: number; lon: number };

// Horizonte de las previsiones. El modelo marino no da datos más allá de unos 10 días
// (comprobado en la fase 0); Forecast se pide igual para que las dos coincidan.
export const DIAS_PREVISION = 10;

// Open-Meteo admite muchas coordenadas por petición; se agrupan de 50 en 50
export const PUNTOS_POR_PETICION = 50;

export const serie = z.array(z.number().nullable());

// Parámetros de todas las peticiones: varias coordenadas, UTC y horas en segundos desde 1970
// (sin ambigüedad de zona horaria)
export function parametrosBase(puntos: Coordenadas[], dias: number) {
  return {
    latitude: puntos.map((p) => p.lat).join(","),
    longitude: puntos.map((p) => p.lon).join(","),
    forecast_days: String(dias),
    timezone: "GMT",
    timeformat: "unixtime",
  };
}

// Con un punto, la API devuelve un objeto; con varios, una lista en el mismo orden.
// Comprueba que hay tantos como se pidieron y que cada variable tiene un valor por hora.
export function comoLista<T extends { hourly: { time: number[] } & Record<string, unknown[]> }>(
  esquema: z.ZodType<T>,
  datos: unknown,
  puntosPedidos: number,
  api: string,
): T[] {
  const lista = z.array(esquema).parse(Array.isArray(datos) ? datos : [datos]);
  if (lista.length !== puntosPedidos) {
    throw new Error(`${api} devolvió ${lista.length} puntos y se pidieron ${puntosPedidos}`);
  }
  for (const { hourly } of lista) {
    for (const [variable, valores] of Object.entries(hourly)) {
      if (valores.length !== hourly.time.length) {
        throw new Error(
          `${api}: ${variable} tiene ${valores.length} valores y hay ${hourly.time.length} horas`,
        );
      }
    }
  }
  return lista;
}
