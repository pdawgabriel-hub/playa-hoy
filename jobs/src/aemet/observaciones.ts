// Cliente de AEMET OpenData: observación convencional de las estaciones automáticas.
// AEMET solo guarda las últimas horas (12 al comprobarlo en octubre de 2026), así que hay que
// descargarlas varias veces al día para no perder ninguna.
import { z } from "zod";

import type { Coordenadas } from "../open-meteo/comun.ts";
import { type OpcionesAemet, consultarUnoAUno, pedirAemet } from "./comun.ts";

// Estaciones de la costa de Murcia que se descargan, una por zona (ver docs/fuentes.md)
export const ESTACIONES_AEMET = [
  { id: "7002Y", nombre: "Águilas" },
  { id: "7007Y", nombre: "Mazarrón/Las Torres" },
  { id: "7012X", nombre: "Cartagena (puerto)" },
  { id: "7019X", nombre: "Cartagena/Salinas Cabo de Palos" },
  { id: "7031X", nombre: "Murcia/San Javier" },
] as const;

const KMH_POR_MS = 3.6;

const valor = z.number().optional();
const esquemaObservaciones = z.array(
  z.object({
    idema: z.string(),
    lat: z.number(),
    lon: z.number(),
    alt: z.number(),
    // Final de la hora observada, en UTC: "2026-10-29T05:00:00+0000"
    fint: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\+0000$/),
    // Viento medio de los 10 minutos anteriores y racha máxima de la hora, en m/s
    vv: valor,
    vmax: valor,
    // Dirección de la que viene el viento, en grados
    dv: valor,
    // Temperatura del aire en el instante de fint, en °C
    ta: valor,
  }),
);

export type HoraObservada = {
  hora: Date;
  // km/h, como en la tabla observaciones
  vientoVelocidad: number | null;
  vientoDireccion: number | null;
  vientoRacha: number | null;
  temperaturaAire: number | null;
};

export type ObservacionEstacion = {
  id: string;
  ubicacion: Coordenadas;
  altitud: number;
  horas: HoraObservada[];
};

// Un dato que falta en una hora (la estación no lo midió) queda en nulo, nunca en 0
const kmh = (ms: number | undefined) =>
  ms === undefined ? null : Math.round(ms * KMH_POR_MS * 10) / 10;

export function leerObservaciones(datos: unknown): ObservacionEstacion {
  const filas = esquemaObservaciones.parse(datos);
  const [primera] = filas;
  if (!primera) throw new Error("AEMET no devolvió ninguna observación");
  if (filas.some((f) => f.idema !== primera.idema)) {
    throw new Error(`AEMET mezcló estaciones en la respuesta de ${primera.idema}`);
  }

  return {
    id: primera.idema,
    ubicacion: { lat: primera.lat, lon: primera.lon },
    altitud: primera.alt,
    horas: filas.map((f) => ({
      hora: new Date(f.fint.replace("+0000", "Z")),
      vientoVelocidad: kmh(f.vv),
      vientoDireccion: f.dv ?? null,
      vientoRacha: kmh(f.vmax),
      temperaturaAire: f.ta ?? null,
    })),
  };
}

export async function consultarEstacionAemet(
  id: string,
  clave: string,
  opciones: OpcionesAemet = {},
) {
  return leerObservaciones(
    await pedirAemet(`/observacion/convencional/datos/estacion/${id}`, clave, opciones),
  );
}

// Una estación detrás de otra; si falla alguna, se sigue con las demás (ver consultarUnoAUno)
export async function consultarEstacionesAemet(
  ids: string[],
  clave: string,
  opciones: OpcionesAemet = {},
) {
  const { resultados, errores } = await consultarUnoAUno(
    ids,
    (id) => consultarEstacionAemet(id, clave, opciones),
    { que: "estación", pausaMs: opciones.pausaMs },
  );
  return { observaciones: resultados, errores };
}
