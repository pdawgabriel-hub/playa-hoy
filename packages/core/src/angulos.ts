// Rumbos en grados: 0 es norte, 90 este, 180 sur y 270 oeste. Sirven igual para hacia dónde
// mira una playa que para de dónde viene el viento o el oleaje (convenio meteorológico).

// Cualquier ángulo, también negativo o mayor de 360, llevado a [0, 360)
export function normalizarRumbo(grados: number): number {
  // Solo se suma 360 a los negativos: sumarlo siempre mete errores de coma flotante
  // ((90,3 + 360) % 360 da 90,30000000000001)
  const resto = grados % 360;
  const rumbo = resto < 0 ? resto + 360 : resto;
  // Con un negativo muy pequeño, el redondeo deja 360 en lugar de 0; y -0 se queda en 0
  return rumbo === 360 ? 0 : rumbo + 0;
}

// Cuánto hay que girar desde `desde` para llegar a `hasta`, por el camino más corto:
// positivo en el sentido de las agujas del reloj, negativo al revés. En (-180, 180].
export function giro(desde: number, hasta: number): number {
  const diferencia = normalizarRumbo(hasta - desde);
  return diferencia > 180 ? diferencia - 360 : diferencia;
}

// Separación entre dos rumbos, sin sentido: de 0 (iguales) a 180 (opuestos)
export function separacion(a: number, b: number): number {
  return Math.abs(giro(a, b));
}

// Rosa de los vientos mediterránea, la que se usa en la costa de Murcia. Cada viento ocupa un
// sector de 45° centrado en su rumbo. Los nombres y sus rumbos siguen las definiciones del
// Diccionario de la lengua española (RAE): tramontana (norte), gregal (nordeste), levante
// (este), jaloque (sudeste), mediodía (sur), lebeche ("en el litoral mediterráneo, viento
// sudoeste"), poniente (oeste) y mistral o maestral (noroeste).
const ROSA = [
  { nombre: "tramontana", punto: "N" },
  { nombre: "gregal", punto: "NE" },
  { nombre: "levante", punto: "E" },
  { nombre: "jaloque", punto: "SE" },
  { nombre: "mediodía", punto: "S" },
  { nombre: "lebeche", punto: "SO" },
  { nombre: "poniente", punto: "O" },
  { nombre: "mistral", punto: "NO" },
] as const;

export type VientoLocal = (typeof ROSA)[number];

// Nombre del viento que viene de `direccion` y su punto cardinal ("levante", "E")
export function vientoLocal(direccion: number): VientoLocal {
  const sector = Math.floor(normalizarRumbo(direccion + 22.5) / 45) % ROSA.length;
  const viento = ROSA[sector];
  if (!viento) throw new Error(`Dirección no válida: ${direccion.toString()}`);
  return viento;
}
