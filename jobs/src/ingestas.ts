import { type Db, esquema } from "@playa-hoy/db";

export type Fuente = "open_meteo" | "aemet" | "aemet_observaciones";

// Lo que devuelve una tarea que ha guardado algo: cuántas filas y qué falló por el camino.
// Si no ha podido guardar nada, la tarea lanza un error (AggregateError si son varios).
export type ResultadoTarea = { filas: number; errores: string[] };

const mensaje = (error: unknown) => (error instanceof Error ? error.message : String(error));

function erroresDe(error: unknown): string[] {
  return error instanceof AggregateError ? error.errors.map(mensaje) : [mensaje(error)];
}

// Ejecuta la ingesta de una fuente y deja constancia en la tabla `ingestas`, vaya bien o mal.
// No relanza el error: así una fuente caída no impide registrar ni ejecutar las demás.
export async function registrarIngesta(
  db: Db,
  fuente: Fuente,
  tarea: () => Promise<ResultadoTarea>,
) {
  const empezadaEn = new Date();
  let filas = 0;
  let errores: string[];
  let estado: "ok" | "parcial" | "error";
  try {
    const resultado = await tarea();
    filas = resultado.filas;
    errores = resultado.errores;
    estado = errores.length > 0 ? "parcial" : "ok";
  } catch (error) {
    errores = erroresDe(error);
    estado = "error";
  }

  const registro = { fuente, empezadaEn, terminadaEn: new Date(), estado, filas, errores };
  await db.insert(esquema.ingestas).values(registro);
  return registro;
}

// Una línea para el registro de GitHub Actions
export function resumirIngesta({
  fuente,
  estado,
  filas,
  errores,
}: Awaited<ReturnType<typeof registrarIngesta>>) {
  return [
    `${fuente}: ${estado}, ${filas.toString()} filas`,
    ...errores.map((e) => `  - ${e}`),
  ].join("\n");
}
