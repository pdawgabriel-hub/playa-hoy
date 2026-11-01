import { crearSlug } from "@playa-hoy/core";
import { type Db, esquema, sql } from "@playa-hoy/db";
import { z } from "zod";

const esquemaFichero = z.object({
  fuente: z.string().min(1),
  municipios: z
    .array(
      z.object({
        // Código INE de un municipio de la Región de Murcia (provincia 30)
        id: z.string().regex(/^30\d{3}$/),
        nombre: z.string().min(1),
      }),
    )
    .min(1)
    .refine((lista) => new Set(lista.map((m) => m.id)).size === lista.length, {
      message: "Hay códigos INE repetidos",
    }),
});

export type Municipio = { id: string; nombre: string; slug: string };

export function leerMunicipios(datos: unknown): Municipio[] {
  return esquemaFichero
    .parse(datos)
    .municipios.map((m) => ({ id: m.id, nombre: m.nombre, slug: crearSlug(m.nombre) }));
}

// Upsert: crea los que faltan y actualiza nombre y slug de los que ya existen.
// Repetirlo no duplica nada.
export async function importarMunicipios(db: Db, municipios: Municipio[]) {
  const filas = await db
    .insert(esquema.municipios)
    .values(municipios)
    .onConflictDoUpdate({
      target: esquema.municipios.id,
      set: { nombre: sql`excluded.nombre`, slug: sql`excluded.slug` },
    })
    // En PostgreSQL, xmax = 0 indica que la fila es nueva y no una actualización
    .returning({ nuevo: sql<boolean>`xmax = 0` });

  const nuevos = filas.filter((f) => f.nuevo).length;
  return { nuevos, actualizados: filas.length - nuevos };
}
