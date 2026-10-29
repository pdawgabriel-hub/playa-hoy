// Claridad del agua: el oleaje remueve el fondo y el agua tarda horas en volver a aclararse
// mientras el sedimento se posa. Por eso no basta con la ola de la hora: se acumula la de
// las horas previas, y cada hora pesa menos cuanto más lejos queda.
//
// Los parámetros (semividas y cortes) son estimaciones razonables, no valores medidos: hay
// que calibrarlos con la transparencia del agua que mide el satélite (fase 12).
import type { Suelo } from "./suelo.ts";

export type Fondo = "grueso" | "arena" | "laguna";

// Horas tras las que la energía de una hora de oleaje pesa la mitad. La grava y la roca
// apenas tienen sedimento fino y aclaran rápido; el Mar Menor, somero y de fondo fangoso,
// tarda más.
export const SEMIVIDA_H: Record<Fondo, number> = { grueso: 6, arena: 12, laguna: 24 };
// Se tienen en cuenta 4 semividas: más allá, una hora pesa menos de 1/16
export const SEMIVIDAS_MEMORIA = 4;
// Cortes en metros de ola equivalente
export const CORTE_CRISTALINA = 0.2;
export const CORTE_TURBIA = 0.5;

export type Claridad = {
  estado: "cristalina" | "buena" | "turbia";
  // De 1 (agua quieta) a 0 (ola equivalente de 1 m o más), para graduar dentro de un estado
  claridad: number;
  // La ola constante que habría removido el fondo lo mismo que las horas previas, en m
  olaEquivalente: number;
};

// El fondo que importa para aclarar el agua, a partir del suelo de la playa (ITREM). Sin
// datos del suelo se supone arena, que es lo más común en la costa de Murcia.
export function fondoDePlaya(suelo: Suelo | null, laguna: boolean): Fondo {
  if (laguna) return "laguna";
  return suelo === "grava" || suelo === "bolos" || suelo === "roca" ? "grueso" : "arena";
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

// `alturas`: la ola en la orilla de cada hora, de la más antigua a la actual (la última).
// Las horas sin dato no cuentan. Sin el dato de la hora actual, devuelve null.
// Hacen falta 4 semividas de horas previas (24 h en grava, 48 h en arena, 96 h en el Mar
// Menor): con menos, la estimación olvida antes de tiempo.
export function estimarClaridad(alturas: (number | null)[], fondo: Fondo): Claridad | null {
  const actual = alturas.at(-1);
  if (actual === null || actual === undefined) return null;

  // Media de la energía (H²) ponderada por la antigüedad: la hora actual pesa 1, la de hace
  // una semivida 0,5, la de hace dos 0,25...
  const semivida = SEMIVIDA_H[fondo];
  const recientes = alturas.slice(-(SEMIVIDAS_MEMORIA * semivida + 1));
  let energia = 0;
  let pesos = 0;
  for (const [i, altura] of recientes.entries()) {
    if (altura === null) continue;
    const antiguedad = recientes.length - 1 - i;
    const peso = 2 ** (-antiguedad / semivida);
    energia += peso * altura ** 2;
    pesos += peso;
  }
  const olaEquivalente = Math.sqrt(energia / pesos);

  const estado =
    olaEquivalente < CORTE_CRISTALINA
      ? "cristalina"
      : olaEquivalente < CORTE_TURBIA
        ? "buena"
        : "turbia";
  // Lineal entre 0 m (1) y el doble del corte de turbia (0): en el corte vale 0,5
  const claridad = Math.max(0, 1 - olaEquivalente / (2 * CORTE_TURBIA));
  return { estado, claridad: redondear(claridad), olaEquivalente: redondear(olaEquivalente) };
}
