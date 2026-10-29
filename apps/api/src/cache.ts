// Cabeceras de caché. Las notas cambian en dos momentos: a cada hora en punto (la hora que
// pasa deja de mostrarse) y tras cada ingesta, a las 00, 06, 12 y 18 UTC, cuando el workflow
// termina (unos minutos después). Se cachea hasta el primero de los dos.

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
// Horas UTC de la ingesta de Open-Meteo (.github/workflows/ingesta.yml)
export const HORAS_INGESTA_UTC = [0, 6, 12, 18];
// Lo que tarda el workflow en dejar las notas nuevas, con holgura
export const MARGEN_INGESTA_MS = 15 * 60_000;
const MINIMO_S = 60;

// Segundos hasta que pueden cambiar las notas
export function segundosHastaCambio(ahora: Date): number {
  const t = ahora.getTime();
  const siguienteHora = (Math.floor(t / HORA_MS) + 1) * HORA_MS;
  const inicioDia = Math.floor(t / DIA_MS) * DIA_MS;
  const ingestas = [0, 1].flatMap((dia) =>
    HORAS_INGESTA_UTC.map((h) => inicioDia + dia * DIA_MS + h * HORA_MS + MARGEN_INGESTA_MS),
  );
  const siguienteIngesta = Math.min(...ingestas.filter((i) => i > t));
  const hasta = Math.min(siguienteHora, siguienteIngesta);
  return Math.max(MINIMO_S, Math.floor((hasta - t) / 1000));
}

// Rutas que dependen de la previsión: hasta el siguiente cambio, en el navegador y en Vercel
export const cachePrevision = (ahora: Date) => {
  const segundos = segundosHastaCambio(ahora).toString();
  return `public, max-age=${segundos}, s-maxage=${segundos}, stale-while-revalidate=60`;
};

// Rutas del catálogo: solo cambian al reimportarlo. Una hora en el navegador, un día en Vercel.
export const CACHE_CATALOGO = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";

// Lo demás (errores, estado): nunca se guarda
export const SIN_CACHE = "no-store";
