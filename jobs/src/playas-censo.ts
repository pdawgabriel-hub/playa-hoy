import { crearSlug, nombreDesdeCenso } from "@playa-hoy/core";
import { type Db, esquema, sql } from "@playa-hoy/db";
import { z } from "zod";

const esquemaCenso = z.object({
  temporada: z.number().int(),
  zonas: z.array(
    z.object({
      codigo: z.string().regex(/^ES620M\d+$/),
      nombre: z.string().min(1),
      lat: z.number(),
      lon: z.number(),
    }),
  ),
});

const esquemaCorrecciones = z.object({
  tildes: z.record(z.string(), z.string()),
  nombres: z.array(z.object({ codigo: z.string(), nombre: z.string(), motivo: z.string() })),
  ubicaciones: z.array(
    z.object({
      codigo: z.string(),
      lat: z.number(),
      lon: z.number(),
      motivo: z.string(),
      fuente: z.string(),
    }),
  ),
});

// Recuadro que contiene toda la costa de la Región de Murcia. Una zona fuera de él es un
// error del censo que hay que corregir en correcciones-censo.json.
const COSTA_MURCIA = { latMin: 37.3, latMax: 37.9, lonMin: -1.8, lonMax: -0.6 };

// "PLAYA LOS NIETOS PM2" -> "PLAYA LOS NIETOS"
const sinPunto = (nombre: string) => nombre.replace(/\s+PM\d+$/, "");

export type PlayaCenso = {
  codigoCenso: string;
  nombre: string;
  slug: string;
  municipioId: string;
  ubicacion: { x: number; y: number };
};

export function prepararPlayasCenso(
  datosCenso: unknown,
  datosCorrecciones: unknown,
  slugsMunicipios: Map<string, string>,
) {
  const { zonas } = esquemaCenso.parse(datosCenso);
  const correcciones = esquemaCorrecciones.parse(datosCorrecciones);
  const nombres = new Map(correcciones.nombres.map((c) => [c.codigo, c.nombre]));
  const ubicaciones = new Map(correcciones.ubicaciones.map((c) => [c.codigo, c]));

  // Una playa con varios puntos de muestreo (PM1, PM2...) se queda con el PM1
  const conPm1 = new Set(
    zonas.filter((zona) => /\sPM1$/.test(zona.nombre)).map((zona) => sinPunto(zona.nombre)),
  );
  const descartadas = zonas.filter((zona) => {
    const [, numero] = /\sPM(\d+)$/.exec(zona.nombre) ?? [];
    return numero !== undefined && numero !== "1" && conPm1.has(sinPunto(zona.nombre));
  });

  const playas = zonas
    .filter((zona) => !descartadas.includes(zona))
    .map((zona) => {
      const { lat, lon } = ubicaciones.get(zona.codigo) ?? zona;
      const fuera =
        lat < COSTA_MURCIA.latMin ||
        lat > COSTA_MURCIA.latMax ||
        lon < COSTA_MURCIA.lonMin ||
        lon > COSTA_MURCIA.lonMax;
      if (fuera) {
        throw new Error(
          `${zona.codigo} (${zona.nombre}) está fuera de la costa de Murcia: ${lat}, ${lon}`,
        );
      }

      // El código lleva el municipio: ES620M + código INE sin la provincia (003 = Águilas)
      const municipioId = `30${zona.codigo.slice(6, 9)}`;
      if (!slugsMunicipios.has(municipioId)) {
        throw new Error(`${zona.codigo}: el municipio ${municipioId} no está importado`);
      }

      const nombre = nombres.get(zona.codigo) ?? nombreDesdeCenso(zona.nombre, correcciones.tildes);
      return {
        codigoCenso: zona.codigo,
        nombre,
        slugBase: crearSlug(nombre),
        municipioId,
        ubicacion: { x: lon, y: lat },
      };
    });

  // Si dos playas se llaman igual, el slug lleva el municipio: "levante-aguilas"
  const repeticiones = new Map<string, number>();
  for (const { slugBase } of playas)
    repeticiones.set(slugBase, (repeticiones.get(slugBase) ?? 0) + 1);
  const conSlug: PlayaCenso[] = playas.map(({ slugBase, ...playa }) =>
    Object.assign(playa, {
      slug:
        (repeticiones.get(slugBase) ?? 0) > 1
          ? `${slugBase}-${slugsMunicipios.get(playa.municipioId)}`
          : slugBase,
    }),
  );

  return {
    playas: conSlug,
    descartadas: descartadas.map((zona) => `${zona.codigo} ${zona.nombre}`),
  };
}

// Upsert por código del censo. Solo toca lo que viene del censo: la zona, la orientación,
// el abrigo y la laguna se calculan en otros pasos y no se pisan.
export async function importarPlayasCenso(db: Db, playas: PlayaCenso[]) {
  const filas = await db
    .insert(esquema.playas)
    .values(playas)
    .onConflictDoUpdate({
      target: esquema.playas.codigoCenso,
      set: {
        nombre: sql`excluded.nombre`,
        slug: sql`excluded.slug`,
        municipioId: sql`excluded.municipio_id`,
        ubicacion: sql`excluded.ubicacion`,
      },
    })
    // En PostgreSQL, xmax = 0 indica que la fila es nueva y no una actualización
    .returning({ nuevo: sql<boolean>`xmax = 0` });

  const nuevas = filas.filter((f) => f.nuevo).length;
  return { nuevas, actualizadas: filas.length - nuevas };
}
