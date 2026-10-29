// Perfil snorkel: agua clara, poca ola (la resaca empuja contra las rocas), viento suave y,
// mejor, fondo de roca, que es donde está la vida marina.
//
// Los umbrales son criterio de playa·hoy, no una norma: están aquí juntos para poder
// revisarlos y explicarlos (ver docs/motor.md).
import type { Suelo } from "../suelo.ts";
import { type Condiciones, type NotaPerfil, combinar, conSuelo, rampa } from "./comun.ts";

// Cuánta vida marina cabe esperar según el suelo de la playa: al revés que para una familia
const FONDO: Record<Suelo, number> = {
  roca: 1,
  bolos: 1,
  arena_y_grava: 0.7,
  grava: 0.6,
  arena: 0.4,
  arena_fina: 0.4,
};
const FONDO_SIN_DATOS = 0.6;

export function notaSnorkel(c: Condiciones): NotaPerfil | null {
  // Sin saber cómo está el agua ni la ola, no se puede recomendar
  if (c.claridad === null || c.olaOrilla === null) return null;

  // Imprescindibles y seguridad: pueden llegar a 0 y vetar la playa. Con el agua turbia no
  // se ve nada bajo el agua.
  const claridad = rampa(c.claridad, 0.85, 0.4);
  const ola = rampa(c.olaOrilla, 0.15, 0.5);
  let viento: number | null = null;
  if (c.vientoVelocidad !== null) {
    viento = c.entradaViento === "calma" ? 1 : rampa(c.vientoVelocidad, 12, 30);
    // El viento de tierra aleja de la orilla al que nada
    if (c.entradaViento === "tierra") viento = Math.min(viento, rampa(c.vientoVelocidad, 10, 25));
  }

  // Comodidad: restan, pero nunca vetan
  const fondo = c.suelo === null ? FONDO_SIN_DATOS : FONDO[c.suelo];
  const agua = c.temperaturaAgua === null ? null : conSuelo(rampa(c.temperaturaAgua, 24, 18), 0.2);
  // Con sol se ve más y con más color bajo el agua
  const sol = c.nubosidad === null ? null : conSuelo(rampa(c.nubosidad, 30, 100), 0.6);

  return combinar([
    { nombre: "claridad", valor: claridad, peso: 0.35 },
    { nombre: "ola", valor: ola, peso: 0.25 },
    { nombre: "fondo", valor: fondo, peso: 0.15 },
    { nombre: "viento", valor: viento, peso: 0.1 },
    { nombre: "temperatura_agua", valor: agua, peso: 0.1 },
    { nombre: "nubosidad", valor: sol, peso: 0.05 },
  ]);
}
