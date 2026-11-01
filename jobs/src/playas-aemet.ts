import { type Db, esquema, asc, eq, inArray, isNotNull, sql } from "@playa-hoy/db";
import { z } from "zod";

import { type PrediccionPlayaAemet, consultarPlayasAemet } from "./aemet/playas.ts";
import type { ResultadoTarea } from "./ingestas.ts";

const esquemaCorrespondencias = z.object({
  correspondencias: z.array(
    z.object({ codigoCenso: z.string(), codigoAemet: z.string().regex(/^\d{7}$/) }),
  ),
});

export type CorrespondenciaAemet = z.infer<typeof esquemaCorrespondencias>["correspondencias"][0];

// Una playa de AEMET no puede ser dos del censo, ni al revés
export function leerCorrespondenciasAemet(datos: unknown): CorrespondenciaAemet[] {
  const { correspondencias } = esquemaCorrespondencias.parse(datos);
  for (const campo of ["codigoCenso", "codigoAemet"] as const) {
    const vistos = new Set<string>();
    for (const c of correspondencias) {
      if (vistos.has(c[campo])) throw new Error(`${campo} repetido: ${c[campo]}`);
      vistos.add(c[campo]);
    }
  }
  return correspondencias;
}

// Pone a cada playa su código de AEMET según la tabla revisada, en una transacción. Las que
// ya no están en la tabla se quedan sin código.
export async function importarCodigosAemet(db: Db, correspondencias: CorrespondenciaAemet[]) {
  const t = esquema.playas;
  return db.transaction(async (tx) => {
    const playas = await tx
      .select({ codigoCenso: t.codigoCenso })
      .from(t)
      .where(
        inArray(
          t.codigoCenso,
          correspondencias.map((c) => c.codigoCenso),
        ),
      );
    const existentes = new Set(playas.map((p) => p.codigoCenso));
    const desconocidas = correspondencias.filter((c) => !existentes.has(c.codigoCenso));
    if (desconocidas.length > 0) {
      throw new Error(
        `No existen las playas del censo ${desconocidas.map((c) => c.codigoCenso).join(", ")}`,
      );
    }

    // Primero se quitan todos: si un código pasa de una playa a otra, no choca con la
    // restricción de código único
    await tx.update(t).set({ codigoAemet: null }).where(isNotNull(t.codigoAemet));
    for (const { codigoCenso, codigoAemet } of correspondencias) {
      await tx.update(t).set({ codigoAemet }).where(eq(t.codigoCenso, codigoCenso));
    }
    return correspondencias.length;
  });
}

export type FilaPrevisionAemet = typeof esquema.previsionesAemet.$inferInsert;

export function filasPrevisionAemet(
  playaId: number,
  prediccion: PrediccionPlayaAemet,
): FilaPrevisionAemet[] {
  return prediccion.dias.map((dia) => ({
    playaId,
    fecha: dia.fecha,
    elaboradaEn: prediccion.elaborado,
    temperaturaAgua: dia.temperaturaAgua,
    temperaturaMaxima: dia.temperaturaMaxima,
    uvMaximo: dia.uvMaximo,
  }));
}

// Guarda la predicción de cada día. Si ya hay una de ese día, solo se sustituye por otra
// elaborada después: repetir la ingesta no cambia nada y una respuesta atrasada no pisa
// una más reciente.
export async function guardarPrevisionesAemet(db: Db, filas: FilaPrevisionAemet[]) {
  if (filas.length === 0) return 0;
  const t = esquema.previsionesAemet;
  const guardadas = await db
    .insert(t)
    .values(filas)
    .onConflictDoUpdate({
      target: [t.playaId, t.fecha],
      set: {
        elaboradaEn: sql`excluded.elaborada_en`,
        temperaturaAgua: sql`excluded.temperatura_agua`,
        temperaturaMaxima: sql`excluded.temperatura_maxima`,
        uvMaximo: sql`excluded.uv_maximo`,
      },
      setWhere: sql`excluded.elaborada_en > ${t.elaboradaEn}`,
    })
    .returning({ playaId: t.playaId });
  return guardadas.length;
}

// La ingesta completa de AEMET: descarga la predicción de las playas con código de AEMET y
// guarda la de cada día. Si falla una playa se sigue con las demás; si no se ha podido
// descargar ninguna, lanza un error.
export async function ingerirAemet(
  db: Db,
  clave: string,
  opciones: Parameters<typeof consultarPlayasAemet>[2] = {},
): Promise<ResultadoTarea> {
  const t = esquema.playas;
  const playas = await db
    .select({ id: t.id, codigoAemet: t.codigoAemet })
    .from(t)
    .where(isNotNull(t.codigoAemet))
    .orderBy(asc(t.codigoAemet));
  if (playas.length === 0) {
    throw new Error("Ninguna playa tiene código de AEMET: ejecuta importar:aemet");
  }

  const { predicciones, errores } = await consultarPlayasAemet(
    playas.map((p) => p.codigoAemet ?? ""),
    clave,
    opciones,
  );
  if (predicciones.size === 0) throw new AggregateError(errores.map((e) => new Error(e)));

  const filas = playas.flatMap((playa) => {
    const prediccion = predicciones.get(playa.codigoAemet ?? "");
    return prediccion ? filasPrevisionAemet(playa.id, prediccion) : [];
  });
  // Solo cuenta los días nuevos o con una predicción más reciente
  return { filas: await guardarPrevisionesAemet(db, filas), errores };
}
