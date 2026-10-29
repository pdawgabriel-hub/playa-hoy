// Perfil tomar el sol: cielo despejado, temperatura agradable y poco viento (arena que
// vuela, frío al estar tumbado). La ola apenas cuenta: no hace falta bañarse.
//
// Los umbrales son criterio de playa·hoy, no una norma: están aquí juntos para poder
// revisarlos y explicarlos (ver docs/motor.md).
import { type Condiciones, type NotaPerfil, combinar, conSuelo, meseta, rampa } from "./comun.ts";

export function notaSol(c: Condiciones): NotaPerfil | null {
  // Sin saber si hay sol ni qué temperatura hace, no se puede recomendar
  if (c.nubosidad === null || c.temperaturaAire === null) return null;

  // Imprescindibles y seguridad: pueden llegar a 0 y vetar la playa. Con 38 °C o más,
  // tumbarse al sol es arriesgarse a un golpe de calor.
  const sol = rampa(c.nubosidad, 20, 90);
  const aire = meseta(c.temperaturaAire, 14, 22, 30, 38);
  // Da igual de dónde venga: no hay hinchables ni nadadores que arrastrar
  let viento: number | null = null;
  if (c.vientoVelocidad !== null) {
    viento = c.entradaViento === "calma" ? 1 : rampa(c.vientoVelocidad, 10, 30);
  }

  // Comodidad: restan, pero nunca vetan
  const ola = c.olaOrilla === null ? null : conSuelo(rampa(c.olaOrilla, 0.5, 1.5), 0.7);
  // Para el chapuzón de refresco
  const agua = c.temperaturaAgua === null ? null : conSuelo(rampa(c.temperaturaAgua, 22, 18), 0.6);

  return combinar([
    { nombre: "nubosidad", valor: sol, peso: 0.35 },
    { nombre: "temperatura_aire", valor: aire, peso: 0.3 },
    { nombre: "viento", valor: viento, peso: 0.25 },
    { nombre: "ola", valor: ola, peso: 0.05 },
    { nombre: "temperatura_agua", valor: agua, peso: 0.05 },
  ]);
}
