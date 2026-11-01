import { crearSlug } from "@playa-hoy/core";
import {
  type Db,
  esquema,
  and,
  eq,
  inArray,
  isNotNull,
  notExists,
  notInArray,
  sql,
} from "@playa-hoy/db";
import { z } from "zod";

const esquemaFichero = z.object({
  zonas: z
    .array(
      z.object({
        nombre: z.string().min(1),
        descripcion: z.string().min(1),
        playas: z
          .array(z.object({ codigo: z.string().regex(/^ES620M\d+$/), nombre: z.string() }))
          .min(1),
      }),
    )
    .min(1),
});

export type Zona = { nombre: string; slug: string; descripcion: string; codigos: string[] };

export function leerZonas(datos: unknown): Zona[] {
  const zonas = esquemaFichero.parse(datos).zonas.map((zona) => ({
    nombre: zona.nombre,
    slug: crearSlug(zona.nombre),
    descripcion: zona.descripcion,
    codigos: zona.playas.map((p) => p.codigo),
  }));

  const slugs = zonas.map((zona) => zona.slug);
  const repetido = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (repetido) throw new Error(`Hay dos zonas con el mismo slug: ${repetido}`);

  const codigos = zonas.flatMap((zona) => zona.codigos);
  const enDos = codigos.find((c, i) => codigos.indexOf(c) !== i);
  if (enDos) throw new Error(`La playa ${enDos} está en dos zonas`);

  return zonas;
}

// Crea o actualiza las zonas y asigna su zona a cada playa, en una transacción.
export async function importarZonas(db: Db, zonas: Zona[]) {
  const { zonas: tZonas, playas: tPlayas } = esquema;

  return db.transaction(async (tx) => {
    const guardadas = await tx
      .insert(tZonas)
      .values(zonas.map(({ nombre, slug, descripcion }) => ({ nombre, slug, descripcion })))
      .onConflictDoUpdate({
        target: tZonas.slug,
        set: { nombre: sql`excluded.nombre`, descripcion: sql`excluded.descripcion` },
      })
      .returning({ id: tZonas.id, slug: tZonas.slug });
    const ids = new Map(guardadas.map((zona) => [zona.slug, zona.id]));

    let asignadas = 0;
    for (const zona of zonas) {
      const filas = await tx
        .update(tPlayas)
        .set({ zonaId: ids.get(zona.slug) })
        .where(inArray(tPlayas.codigoCenso, zona.codigos))
        .returning({ codigo: tPlayas.codigoCenso });
      if (filas.length !== zona.codigos.length) {
        const encontrados = new Set(filas.map((f) => f.codigo));
        const faltan = zona.codigos.filter((c) => !encontrados.has(c));
        throw new Error(`Zona ${zona.nombre}: no existen las playas ${faltan.join(", ")}`);
      }
      asignadas += filas.length;
    }

    // Las playas del censo que ya no están en ninguna zona se quedan sin zona
    const todas = zonas.flatMap((zona) => zona.codigos);
    await tx
      .update(tPlayas)
      .set({ zonaId: null })
      .where(and(isNotNull(tPlayas.codigoCenso), notInArray(tPlayas.codigoCenso, todas)));

    // Zonas que ya no están en el fichero y se han quedado sin playas (por ejemplo, al
    // renombrar una)
    const borradas = await tx
      .delete(tZonas)
      .where(
        and(
          notInArray(
            tZonas.slug,
            zonas.map((zona) => zona.slug),
          ),
          notExists(tx.select().from(tPlayas).where(eq(tPlayas.zonaId, tZonas.id))),
        ),
      )
      .returning({ slug: tZonas.slug });

    return {
      zonas: guardadas.length,
      playas: asignadas,
      borradas: borradas.map((zona) => zona.slug),
    };
  });
}
