// Perfil familia con niños: poca ola, viento suave, sin viento de tierra fuerte (arrastra
// colchonetas e hinchables mar adentro), temperaturas agradables y, si puede ser, socorrista.
//
// Los umbrales son criterio de playa·hoy, no una norma: están aquí juntos para poder
// revisarlos y explicarlos (ver docs/motor.md).
import {
  type Condiciones,
  type NotaPerfil,
  combinar,
  conSuelo,
  ladoDeMeseta,
  meseta,
  rampa,
} from "./comun.ts";

export function notaFamilia(c: Condiciones): NotaPerfil | null {
  // Sin la ola o el viento no se puede recomendar una playa a una familia
  if (c.olaOrilla === null || c.vientoVelocidad === null) return null;

  // Seguridad: pueden llegar a 0 y vetar la playa
  const ola = rampa(c.olaOrilla, 0.2, 0.6);
  let viento = c.entradaViento === "calma" ? 1 : rampa(c.vientoVelocidad, 12, 35);
  if (c.entradaViento === "tierra") viento = Math.min(viento, rampa(c.vientoVelocidad, 8, 20));

  // Comodidad: restan, pero nunca vetan
  const aire =
    c.temperaturaAire === null ? null : conSuelo(meseta(c.temperaturaAire, 16, 24, 30, 38), 0.2);
  const agua = c.temperaturaAgua === null ? null : conSuelo(rampa(c.temperaturaAgua, 24, 18), 0.2);
  const claridad = c.claridad === null ? null : conSuelo(rampa(c.claridad, 0.8, 0), 0.5);
  // OpenStreetMap no dice en qué meses hay socorrista: pesa poco
  const socorrista = c.socorrista === null ? 0.8 : c.socorrista ? 1 : 0.6;

  return combinar([
    { nombre: "ola", valor: ola, peso: 0.35 },
    { nombre: "viento", valor: viento, peso: 0.2 },
    {
      nombre: "temperatura_aire",
      valor: aire,
      peso: 0.15,
      lado: ladoDeMeseta(c.temperaturaAire, 24, 30),
    },
    { nombre: "temperatura_agua", valor: agua, peso: 0.15 },
    { nombre: "claridad", valor: claridad, peso: 0.1 },
    { nombre: "socorrista", valor: socorrista, peso: 0.05 },
  ]);
}
