// Bandera probable: la que es de esperar que ice el socorrista según la ola y el viento.
// La decide el socorrista en la playa, coordinado con el ayuntamiento, así que esto es una
// estimación y hay que presentarla como tal. Solo tiene sentido en playas con socorrista.
//
// No hay criterios oficiales con cifras: el plan COPLA de la Región de Murcia no los fija.
// La referencia es el plan de salvamento de Vélez-Málaga: verde con mar tranquilo y sin
// riesgo aparente, amarilla con "olas de 1,5 m de altura y corrientes moderadamente
// fuertes" y roja cuando se prohíbe el baño. El corte de la verde (0,5 m) y los del viento
// son criterio de playa·hoy; el del viento de tierra sigue la práctica de la costa de Murcia
// y Alicante de izar la amarilla con poniente, que arrastra las colchonetas mar adentro.
import type { Entrada } from "./viento.ts";

export type Bandera = "verde" | "amarilla" | "roja";

export const OLA_AMARILLA_M = 0.5;
export const OLA_ROJA_M = 2;
export const VIENTO_AMARILLA_KMH = 40;
export const VIENTO_TIERRA_AMARILLA_KMH = 20;

export type MotivoBandera = "ola" | "viento" | "viento_tierra";

export type BanderaProbable = {
  bandera: Bandera;
  // Por qué no es verde; vacío si lo es
  motivos: MotivoBandera[];
};

// Null si falta la ola: sin ella no se puede estimar
export function banderaProbable(
  olaOrilla: number | null,
  vientoVelocidad: number | null,
  entradaViento: Entrada | null,
): BanderaProbable | null {
  if (olaOrilla === null) return null;
  if (olaOrilla >= OLA_ROJA_M) return { bandera: "roja", motivos: ["ola"] };

  const motivos: MotivoBandera[] = [];
  if (olaOrilla >= OLA_AMARILLA_M) motivos.push("ola");
  if (vientoVelocidad !== null) {
    if (entradaViento === "tierra" && vientoVelocidad >= VIENTO_TIERRA_AMARILLA_KMH) {
      motivos.push("viento_tierra");
    } else if (vientoVelocidad >= VIENTO_AMARILLA_KMH) {
      motivos.push("viento");
    }
  }
  return { bandera: motivos.length > 0 ? "amarilla" : "verde", motivos };
}
