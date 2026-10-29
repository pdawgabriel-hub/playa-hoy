// Salida y puesta del sol con la ecuación del orto (el método simplificado de la NOAA, con
// un error de un par de minutos). Así las horas de día cambian con la fecha y el lugar, en
// lugar de fijar a mano unas horas iguales todo el año.

export type Luz = { orto: Date; ocaso: Date };

const RAD = Math.PI / 180;
const DIA_MS = 86_400_000;
// Día juliano del 1 de enero de 2000 a mediodía (época J2000) y del 1 de enero de 1970
const J2000 = 2_451_545;
const JULIANO_1970 = 2_440_587.5;
// El sol "sale" cuando su borde superior asoma: centro a 0,833° bajo el horizonte, por la
// refracción de la atmósfera y el radio del disco
const ALTURA_ORTO = -0.833;
// Inclinación del eje de la Tierra
const OBLICUIDAD = 23.4397;

const seno = (grados: number) => Math.sin(grados * RAD);

// `dia`: "2026-06-21", el día del calendario. Devuelve los instantes en UTC. Null si ese día
// el sol no sale o no se pone (solo pasa cerca de los polos).
export function ortoYOcaso(dia: string, lat: number, lon: number): Luz | null {
  const mediodiaUtc = Date.parse(`${dia}T12:00:00Z`);
  if (Number.isNaN(mediodiaUtc)) throw new Error(`Día no válido: ${dia}`);

  const n = Math.round(mediodiaUtc / DIA_MS + JULIANO_1970 - J2000);
  // Mediodía solar medio en este meridiano (longitud positiva al este)
  const mediodiaMedio = n - lon / 360;
  const anomalia = (357.5291 + 0.985_600_28 * mediodiaMedio) % 360;
  const centro = 1.9148 * seno(anomalia) + 0.02 * seno(2 * anomalia) + 0.0003 * seno(3 * anomalia);
  const longitudEcliptica = (anomalia + centro + 180 + 102.9372) % 360;
  const transito =
    J2000 + mediodiaMedio + 0.0053 * seno(anomalia) - 0.0069 * seno(2 * longitudEcliptica);

  const declinacion = Math.asin(seno(longitudEcliptica) * seno(OBLICUIDAD));
  const cosAngulo =
    (seno(ALTURA_ORTO) - seno(lat) * Math.sin(declinacion)) /
    (Math.cos(lat * RAD) * Math.cos(declinacion));
  if (cosAngulo < -1 || cosAngulo > 1) return null;
  const angulo = Math.acos(cosAngulo) / RAD;

  const aFecha = (juliano: number) => new Date((juliano - JULIANO_1970) * DIA_MS);
  return { orto: aFecha(transito - angulo / 360), ocaso: aFecha(transito + angulo / 360) };
}
