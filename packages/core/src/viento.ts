// Cómo le llega el viento a una playa: de mar, de lado o de tierra. Depende de hacia dónde
// mira la playa y de dónde viene el viento. Si una playa mira al este (90°) y sopla levante
// (de 90°), el viento le llega desde el mar, de frente.
import { separacion } from "./angulos.ts";

export type Entrada = "mar" | "lado" | "tierra" | "calma";

export type EntradaViento = {
  entrada: Entrada;
  // De 1 (de mar, de frente) a -1 (de tierra, de frente); 0 de lado puro o en calma.
  // Permite a los perfiles graduar dentro de una misma categoría.
  haciaTierra: number;
};

// Por debajo, el viento no cuenta: fuerza 0 y 1 de la escala de Beaufort (calma y
// ventolina, hasta 5 km/h). La dirección de un viento tan flojo cambia mucho y no significa
// nada para la playa.
export const VIENTO_CALMA_KMH = 6;
// Cortes en grados de separación entre la orientación de la playa y el viento: cada
// categoría ocupa un tercio de la rosa (120°)
export const LIMITE_MAR = 60;
export const LIMITE_TIERRA = 120;

// `mira`: rumbo de la playa hacia el mar. `direccion`: de dónde viene el viento, en grados.
// `velocidad`: km/h. Si falta alguno de los tres, no se puede saber: devuelve null.
export function entradaViento(
  mira: number | null,
  direccion: number | null,
  velocidad: number | null,
): EntradaViento | null {
  if (mira === null || direccion === null || velocidad === null) return null;
  if (velocidad < VIENTO_CALMA_KMH) return { entrada: "calma", haciaTierra: 0 };

  const grados = separacion(mira, direccion);
  // + 0 evita un -0 en el lado puro (cos 90° no da exactamente 0)
  const haciaTierra = Math.round(Math.cos((grados * Math.PI) / 180) * 100) / 100 + 0;
  const entrada = grados <= LIMITE_MAR ? "mar" : grados < LIMITE_TIERRA ? "lado" : "tierra";
  return { entrada, haciaTierra };
}
