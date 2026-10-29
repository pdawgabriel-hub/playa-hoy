// Municipios y zonas: las dos formas de agrupar las playas
import { createRoute, z } from "@hono/zod-openapi";
import { type Db, esquema } from "@playa-hoy/db";
import { count, eq } from "drizzle-orm";

import { CACHE_CATALOGO } from "../cache.ts";
import { lista, porNombre } from "../comun.ts";
import { crearRouter } from "../errores.ts";

const EsquemaMunicipio = z
  .object({
    id: z.string().openapi({ description: "Código INE", example: "30003" }),
    nombre: z.string().openapi({ example: "Águilas" }),
    slug: z.string().openapi({ example: "aguilas" }),
    playas: z.number().int().openapi({ description: "Número de playas", example: 12 }),
  })
  .openapi("Municipio");

const EsquemaZona = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    nombre: z.string().openapi({ example: "Mar Menor" }),
    slug: z.string().openapi({ example: "mar-menor" }),
    descripcion: z.string().nullable(),
    playas: z.number().int().openapi({ description: "Número de playas", example: 22 }),
    municipios: z
      .array(z.object({ id: z.string(), nombre: z.string() }))
      .openapi({ description: "Municipios con playas en la zona" }),
  })
  .openapi("Zona");

const rutaMunicipios = createRoute({
  method: "get",
  path: "/v1/municipios",
  tags: ["Catálogo"],
  summary: "Municipios costeros con playas, por orden alfabético",
  responses: {
    200: {
      description: "Los municipios",
      content: { "application/json": { schema: lista(EsquemaMunicipio) } },
    },
  },
});

const rutaZonas = createRoute({
  method: "get",
  path: "/v1/zonas",
  tags: ["Catálogo"],
  summary: "Zonas de la costa (Mar Menor, La Manga…), por orden alfabético",
  responses: {
    200: {
      description: "Las zonas",
      content: { "application/json": { schema: lista(EsquemaZona) } },
    },
  },
});

export function rutasCatalogo(db: Db) {
  const { municipios, zonas, playas } = esquema;

  return crearRouter()
    .openapi(rutaMunicipios, async (c) => {
      const filas = await db
        .select({
          id: municipios.id,
          nombre: municipios.nombre,
          slug: municipios.slug,
          playas: count(playas.id),
        })
        .from(municipios)
        .leftJoin(playas, eq(playas.municipioId, municipios.id))
        .groupBy(municipios.id);
      c.header("Cache-Control", CACHE_CATALOGO);
      return c.json({ datos: filas.toSorted(porNombre) }, 200);
    })
    .openapi(rutaZonas, async (c) => {
      const filas = await db.select().from(zonas);
      // Qué municipios tiene cada zona sale de sus playas
      const relaciones = await db
        .selectDistinct({ zonaId: playas.zonaId, id: municipios.id, nombre: municipios.nombre })
        .from(playas)
        .innerJoin(municipios, eq(municipios.id, playas.municipioId));
      const cuentas = await db
        .select({ zonaId: playas.zonaId, playas: count() })
        .from(playas)
        .groupBy(playas.zonaId);
      const porZona = Map.groupBy(relaciones, (r) => r.zonaId);
      const playasPorZona = new Map(cuentas.map((fila) => [fila.zonaId, fila.playas]));

      const datos = filas
        .map((zona) => ({
          id: zona.id,
          nombre: zona.nombre,
          slug: zona.slug,
          descripcion: zona.descripcion,
          playas: playasPorZona.get(zona.id) ?? 0,
          municipios: (porZona.get(zona.id) ?? [])
            .map(({ id, nombre }) => ({ id, nombre }))
            .toSorted(porNombre),
        }))
        .toSorted(porNombre);
      c.header("Cache-Control", CACHE_CATALOGO);
      return c.json({ datos }, 200);
    });
}
