// Perfil surf, con la lógica al revés que los demás: se busca ola en la orilla, de periodo
// largo, y viento de tierra, que la peina; el de mar la deshace. El abrigo no es un factor
// aparte: ya está en la ola en la orilla, y una playa abrigada no recibe ola.
//
// Los umbrales son criterio de playa·hoy, no una norma: están aquí juntos para poder
// revisarlos y explicarlos (ver docs/motor.md).
import type { Entrada } from "../viento.ts";
import { type Condiciones, type NotaPerfil, combinar, conSuelo, meseta, rampa } from "./comun.ts";

// Viento bueno y malo en km/h según cómo entra en la playa. Un viento de tierra muy fuerte
// también estorba: cuesta remar hasta el pico.
const VIENTO: Record<Exclude<Entrada, "calma">, [bueno: number, malo: number]> = {
  tierra: [25, 45],
  lado: [10, 30],
  mar: [8, 25],
};

export function notaSurf(c: Condiciones): NotaPerfil | null {
  // Sin la ola no hay nada que puntuar
  if (c.olaOrilla === null) return null;

  // Imprescindible: sin ola no hay surf y, en una costa sin picos de ola grande, a partir de
  // 2,8 m es peligroso
  const ola = meseta(c.olaOrilla, 0.3, 0.7, 1.8, 2.8);
  // Calidad: con periodo corto es mar de viento, desordenada. El Mediterráneo rara vez pasa
  // de 9 s, así que el corte está por debajo de lo que se pediría en el Atlántico. El Mar
  // Menor queda fuera: hasta 40 km/h su ola de viento no llega a 4 s, y con más viento la
  // veta el viento de mar.
  const periodo = c.olaPeriodo === null ? null : rampa(c.olaPeriodo, 8, 4);
  let viento: number | null = null;
  if (c.vientoVelocidad !== null && c.entradaViento !== null) {
    viento = c.entradaViento === "calma" ? 1 : rampa(c.vientoVelocidad, ...VIENTO[c.entradaViento]);
  }

  // Comodidad: con neopreno se aguanta el agua fría
  const agua = c.temperaturaAgua === null ? null : conSuelo(rampa(c.temperaturaAgua, 20, 14), 0.5);
  const aire =
    c.temperaturaAire === null ? null : conSuelo(meseta(c.temperaturaAire, 8, 15, 32, 38), 0.5);

  return combinar([
    { nombre: "ola", valor: ola, peso: 0.4 },
    { nombre: "periodo", valor: periodo, peso: 0.25 },
    { nombre: "viento", valor: viento, peso: 0.25 },
    { nombre: "temperatura_agua", valor: agua, peso: 0.05 },
    { nombre: "temperatura_aire", valor: aire, peso: 0.05 },
  ]);
}
