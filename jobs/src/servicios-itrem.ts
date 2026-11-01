import { clasificarSuelo } from "@playa-hoy/core";
import { type Db, esquema, sql } from "@playa-hoy/db";
import { z } from "zod";

const esquemaItrem = z.object({
  playas: z.array(
    z.object({
      codigo: z.string(),
      nombre: z.string(),
      suelo: z.string(),
      ocupacion: z.string(),
      nudista: z.string(),
      accesible: z.string(),
    }),
  ),
});

const esquemaCorrespondencias = z.object({
  correspondencias: z.array(z.object({ codigoCenso: z.string(), codigoItrem: z.string() })),
});

type Ocupacion = "baja" | "media" | "alta";
const OCUPACION = new Map<string, Ocupacion>([
  ["Bajo", "baja"],
  ["Medio", "media"],
  ["Alto", "alta"],
]);

// "Sí" / "No" de ITREM. Cualquier otra cosa es que no se sabe.
const siNo = (valor: string) => (valor === "Sí" ? true : valor === "No" ? false : null);

export type ServiciosItrem = {
  playaId: number;
  accesible: boolean | null;
  nudista: boolean | null;
  suelo: ReturnType<typeof clasificarSuelo>;
  ocupacion: Ocupacion | null;
};

// `idsPlayas`: id de cada playa por su código del censo
export function prepararServiciosItrem(
  datosItrem: unknown,
  datosCorrespondencias: unknown,
  idsPlayas: Map<string, number>,
): ServiciosItrem[] {
  const itrem = new Map(esquemaItrem.parse(datosItrem).playas.map((p) => [p.codigo, p]));
  const { correspondencias } = esquemaCorrespondencias.parse(datosCorrespondencias);

  return correspondencias.map(({ codigoCenso, codigoItrem }) => {
    const playaId = idsPlayas.get(codigoCenso);
    if (playaId === undefined) throw new Error(`No existe la playa del censo ${codigoCenso}`);
    const p = itrem.get(codigoItrem);
    if (!p) throw new Error(`No existe la playa ITREM ${codigoItrem} (${codigoCenso})`);

    return {
      playaId,
      accesible: siNo(p.accesible),
      nudista: siNo(p.nudista),
      suelo: clasificarSuelo(p.suelo),
      ocupacion: OCUPACION.get(p.ocupacion) ?? null,
    };
  });
}

// Upsert que solo toca los datos de ITREM: socorrista, perros, aseos y duchas son de OSM.
export async function importarServiciosItrem(db: Db, servicios: ServiciosItrem[]) {
  const t = esquema.playaServicios;
  const filas = await db
    .insert(t)
    .values(servicios.map((s) => ({ ...s, fuentes: ["itrem"] })))
    .onConflictDoUpdate({
      target: t.playaId,
      set: {
        accesible: sql`excluded.accesible`,
        nudista: sql`excluded.nudista`,
        suelo: sql`excluded.suelo`,
        ocupacion: sql`excluded.ocupacion`,
        // Añade "itrem" a las fuentes de la fila si no estaba
        fuentes: sql`CASE WHEN 'itrem' = ANY(${t.fuentes}) THEN ${t.fuentes} ELSE array_append(${t.fuentes}, 'itrem') END`,
        actualizadoEn: sql`now()`,
      },
    })
    // En PostgreSQL, xmax = 0 indica que la fila es nueva y no una actualización
    .returning({ nueva: sql<boolean>`xmax = 0` });

  const nuevas = filas.filter((f) => f.nueva).length;
  return { nuevas, actualizadas: filas.length - nuevas };
}
