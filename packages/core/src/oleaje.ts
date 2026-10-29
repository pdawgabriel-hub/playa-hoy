// Oleaje que llega a la orilla de una playa. Open-Meteo da el oleaje mar adentro, en una
// celda de unos 9 km: lo que llega a cada playa depende de desde dónde entra respecto a su
// orientación y de cuánto mar libre tiene delante en esa dirección. El modelo marino no
// cubre el Mar Menor: en la laguna la ola se estima con el viento local.
import { ALCANCE_ABIERTO_M } from "./abrigo.ts";
import { giro, separacion } from "./angulos.ts";

// Abanico de rayos guardado en playas.alcances: de mira - 90° a mira + 90° cada 5°
const PASO_RAYOS = 5;
const RAYOS = 180 / PASO_RAYOS + 1;
const G = 9.81;
const KMH_POR_MS = 3.6;
// El rayo más largo dentro de la laguna mide 20,7 km (de La Puntica a Playa Honda, de un
// extremo al otro); los más largos se escapan al Mediterráneo por las golas de La Manga
export const ALCANCE_MAXIMO_LAGUNA_M = 21_000;

export type PlayaOleaje = {
  mira: number | null;
  laguna: boolean;
  alcances: number[] | null;
};

export type HoraOleaje = {
  // Mar adentro: altura significativa en m, dirección de la que viene en grados y periodo
  // en s
  olaAltura: number | null;
  olaDireccion: number | null;
  olaPeriodo: number | null;
  // km/h y grados de los que viene
  vientoVelocidad: number | null;
  vientoDireccion: number | null;
};

export type OleajeOrilla = {
  // Altura significativa en la orilla, en m
  altura: number;
  // Periodo en s: el del modelo marino o, en el Mar Menor, el estimado de la ola de viento.
  // Nulo si no se sabe o si no hay ola.
  periodo: number | null;
  // De dónde sale: del modelo marino o, en el Mar Menor, del viento local
  origen: "mar_adentro" | "viento_local";
};

// Metros de mar libre desde la playa hacia `rumbo`, interpolando entre los dos rayos más
// cercanos. Null si el rumbo queda detrás de la playa (a más de 90° de donde mira).
export function alcanceEn(mira: number, alcances: number[], rumbo: number): number | null {
  if (alcances.length !== RAYOS) throw new Error(`Se esperaban ${RAYOS.toString()} rayos`);
  const desvio = giro(mira, rumbo);
  if (Math.abs(desvio) > 90) return null;
  const posicion = (desvio + 90) / PASO_RAYOS;
  const i = Math.min(Math.floor(posicion), RAYOS - 2);
  const t = posicion - i;
  return (alcances[i] ?? 0) * (1 - t) + (alcances[i + 1] ?? 0) * t;
}

// La energía que llega a la orilla es proporcional al coseno del ángulo de llegada, y la
// altura a la raíz de la energía. De 90° en adelante, la ola no entra.
const factorAngulo = (grados: number) =>
  grados >= 90 ? 0 : Math.sqrt(Math.cos((grados * Math.PI) / 180));

const redondear = (metros: number) => Math.round(metros * 100) / 100;

// Mediterráneo: la ola mar adentro, reducida por el ángulo de llegada y por lo que tape la
// costa en esa dirección (con 30 km de mar libre o más, entra entera).
function oleajeMarAdentro(mira: number, alcances: number[], hora: HoraOleaje) {
  const { olaAltura, olaDireccion, olaPeriodo } = hora;
  if (olaAltura === null || olaDireccion === null) return null;
  const alcance = alcanceEn(mira, alcances, olaDireccion);
  const apertura = alcance === null ? 0 : Math.min(alcance / ALCANCE_ABIERTO_M, 1);
  const altura = olaAltura * factorAngulo(separacion(mira, olaDireccion)) * apertura;
  return { altura, periodo: olaPeriodo };
}

// Mar Menor: ola de viento limitada por el alcance, con las relaciones del Shore Protection
// Manual (US Army Corps of Engineers, 1984), basadas en JONSWAP:
//   g·H / U² = 0,0016 · (g·F / U²)^½      ->  H = 0,0016 · U · √(F / g)
//   g·T / U  = 0,2857 · (g·F / U²)^⅓
// con U el viento en m/s y F los metros de laguna que tiene en contra. El viento de tierra
// no levanta ola en la orilla.
function oleajeVientoLocal(mira: number, alcances: number[], hora: HoraOleaje) {
  const { vientoVelocidad, vientoDireccion } = hora;
  if (vientoVelocidad === null || vientoDireccion === null) return null;
  const alcance = alcanceEn(mira, alcances, vientoDireccion);
  const viento = vientoVelocidad / KMH_POR_MS;
  if (alcance === null || viento <= 0) return { altura: 0, periodo: null };
  const metrosLaguna = Math.min(alcance, ALCANCE_MAXIMO_LAGUNA_M);
  const altura = 0.0016 * viento * Math.sqrt(metrosLaguna / G);
  const periodo = 0.2857 * (viento / G) * Math.cbrt((G * metrosLaguna) / viento ** 2);
  return { altura: altura * factorAngulo(separacion(mira, vientoDireccion)), periodo };
}

// Oleaje en la orilla de una playa a una hora. Null si falta algún dato para calcularlo.
export function oleajeEnOrilla(playa: PlayaOleaje, hora: HoraOleaje): OleajeOrilla | null {
  const { mira, alcances, laguna } = playa;
  if (mira === null || alcances === null) return null;
  const ola = laguna
    ? oleajeVientoLocal(mira, alcances, hora)
    : oleajeMarAdentro(mira, alcances, hora);
  if (ola === null) return null;
  return {
    altura: redondear(ola.altura),
    periodo: ola.periodo === null ? null : Math.round(ola.periodo * 10) / 10,
    origen: laguna ? "viento_local" : "mar_adentro",
  };
}
