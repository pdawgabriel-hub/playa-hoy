// Abrigo de una playa: cuánto la protegen cabos, bahías o la propia costa del oleaje.
// Se mide con el alcance hacia el mar (fetch): desde la playa se lanzan rayos en el abanico
// que tiene delante y se mira cuánto recorre cada uno hasta chocar con tierra. Por donde hay
// mucho mar libre entra el oleaje; donde los rayos chocan pronto, la playa está abrigada.
import { giro, normalizarRumbo } from "./angulos.ts";

export type Alcance = {
  // Rumbo del rayo en grados
  azimut: number;
  // Metros de mar hasta la primera tierra (o el máximo calculado si no choca)
  distanciaM: number;
};

// A partir de esta distancia de mar libre, el rayo cuenta como mar abierto
const ALCANCE_ABIERTO_M = 30_000;

// Rumbos del abanico que tiene delante una playa: de mira - 90° a mira + 90°
export function abanicoDeRayos(mira: number, pasoGrados = 5): number[] {
  const total = Math.floor(180 / pasoGrados) + 1;
  return Array.from({ length: total }, (_, i) => normalizarRumbo(mira - 90 + i * pasoGrados));
}

// De 0 (totalmente expuesta) a 1 (totalmente cerrada). Los rayos de frente pesan más que los
// laterales: el oleaje que llega de lado rompe menos en la orilla.
export function calcularAbrigo(mira: number, alcances: Alcance[]): number | null {
  let apertura = 0;
  let pesos = 0;
  for (const { azimut, distanciaM } of alcances) {
    const desvio = giro(mira, azimut);
    const peso = Math.cos((desvio * Math.PI) / 180);
    if (peso <= 0) continue;
    apertura += peso * Math.min(distanciaM / ALCANCE_ABIERTO_M, 1);
    pesos += peso;
  }
  if (pesos === 0) return null;
  return Math.round((1 - apertura / pesos) * 100) / 100;
}
