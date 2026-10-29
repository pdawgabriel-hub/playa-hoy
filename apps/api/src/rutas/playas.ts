// Lista de playas, con filtros por zona, municipio y servicios
import { createRoute, z } from "@hono/zod-openapi";
import { type Db, esquema, type SQL, and, desc, eq } from "@playa-hoy/db";

import { CACHE_CATALOGO } from "../cache.ts";
import { lista, porNombre } from "../comun.ts";
import { EsquemaError, crearRouter, cuerpoError, respuestaError } from "../errores.ts";

const SERVICIOS = ["socorrista", "perros", "accesible", "aseos", "duchas", "nudista"] as const;

const siNo = (descripcion: string) =>
  z.enum(["true", "false"]).optional().openapi({ description: descripcion });

const EsquemaFiltros = z.object({
  zona: z.string().optional().openapi({ description: "Slug de la zona", example: "mar-menor" }),
  municipio: z
    .string()
    .optional()
    .openapi({ description: "Slug del municipio", example: "cartagena" }),
  laguna: siNo("Solo playas del Mar Menor (true) o del Mediterráneo (false)"),
  socorrista: siNo("Con socorrista en temporada de baño"),
  perros: siNo("Se admiten perros"),
  accesible: siNo("Accesible para personas con movilidad reducida"),
  aseos: siNo("Con aseos"),
  duchas: siNo("Con duchas"),
  nudista: siNo("Playa nudista"),
});

const servicio = (descripcion: string) =>
  z
    .boolean()
    .nullable()
    .openapi({ description: `${descripcion}. Nulo: no se sabe` });

const EsquemaPlaya = z
  .object({
    id: z.number().int().openapi({ example: 12 }),
    nombre: z.string().openapi({ example: "Los Narejos" }),
    slug: z.string().openapi({ example: "los-narejos" }),
    municipio: z.object({ id: z.string(), nombre: z.string(), slug: z.string() }),
    zona: z.object({ id: z.number().int(), nombre: z.string(), slug: z.string() }).nullable(),
    ubicacion: z.object({ lat: z.number(), lon: z.number() }),
    laguna: z.boolean().openapi({ description: "Playa del Mar Menor" }),
    mira: z
      .number()
      .nullable()
      .openapi({ description: "Hacia dónde mira, en grados (0 = norte, 90 = este)" }),
    servicios: z.object({
      socorrista: servicio("Socorrista en temporada de baño"),
      perros: servicio("Se admiten perros"),
      accesible: servicio("Accesible"),
      aseos: servicio("Aseos"),
      duchas: servicio("Duchas"),
      nudista: servicio("Nudista"),
      suelo: z.enum(["arena_fina", "arena", "arena_y_grava", "grava", "bolos", "roca"]).nullable(),
      ocupacion: z.enum(["baja", "media", "alta"]).nullable(),
    }),
    calidadAgua: z
      .object({
        temporada: z.number().int().openapi({ example: 2025 }),
        calificacion: z.enum([
          "excelente",
          "buena",
          "suficiente",
          "insuficiente",
          "sin_clasificar",
        ]),
      })
      .nullable()
      .openapi({ description: "Calificación oficial de la última temporada (EEA)" }),
  })
  .openapi("Playa");

const ruta = createRoute({
  method: "get",
  path: "/v1/playas",
  tags: ["Playas"],
  summary: "Playas, con filtros por zona, municipio y servicios",
  description:
    "Los servicios admiten true o false. Una playa de la que no se sabe un servicio no aparece " +
    "con ningún filtro de ese servicio: no se presenta como dato lo que no lo es.",
  request: { query: EsquemaFiltros },
  responses: {
    400: respuestaError("Parámetros no válidos"),
    200: {
      description: "Las playas que cumplen los filtros, por orden alfabético",
      content: { "application/json": { schema: lista(EsquemaPlaya) } },
    },
    404: {
      description: "La zona o el municipio no existen",
      content: { "application/json": { schema: EsquemaError } },
    },
  },
});

export function rutasPlayas(db: Db) {
  const { playas, municipios, zonas, playaServicios, calidadAgua } = esquema;

  return crearRouter().openapi(ruta, async (c) => {
    const filtros = c.req.valid("query");
    const condiciones: SQL[] = [];

    if (filtros.zona !== undefined) {
      const [zona] = await db
        .select({ id: zonas.id })
        .from(zonas)
        .where(eq(zonas.slug, filtros.zona));
      if (!zona)
        return c.json(cuerpoError("no_encontrado", `No existe la zona ${filtros.zona}`), 404);
      condiciones.push(eq(playas.zonaId, zona.id));
    }
    if (filtros.municipio !== undefined) {
      const [municipio] = await db
        .select({ id: municipios.id })
        .from(municipios)
        .where(eq(municipios.slug, filtros.municipio));
      if (!municipio)
        return c.json(
          cuerpoError("no_encontrado", `No existe el municipio ${filtros.municipio}`),
          404,
        );
      condiciones.push(eq(playas.municipioId, municipio.id));
    }
    if (filtros.laguna !== undefined)
      condiciones.push(eq(playas.laguna, filtros.laguna === "true"));
    // Con false, eq deja fuera también los nulos: "no se sabe" no es "no tiene"
    for (const nombre of SERVICIOS) {
      const valor = filtros[nombre];
      if (valor !== undefined) condiciones.push(eq(playaServicios[nombre], valor === "true"));
    }

    const filas = await db
      .select({
        playa: playas,
        municipio: { id: municipios.id, nombre: municipios.nombre, slug: municipios.slug },
        zona: { id: zonas.id, nombre: zonas.nombre, slug: zonas.slug },
        servicios: playaServicios,
      })
      .from(playas)
      .innerJoin(municipios, eq(municipios.id, playas.municipioId))
      .leftJoin(zonas, eq(zonas.id, playas.zonaId))
      .leftJoin(playaServicios, eq(playaServicios.playaId, playas.id))
      .where(and(...condiciones));

    // La última temporada calificada de cada playa
    const calidades = await db
      .selectDistinctOn([calidadAgua.playaId])
      .from(calidadAgua)
      .orderBy(calidadAgua.playaId, desc(calidadAgua.temporada));
    const calidadPorPlaya = new Map(calidades.map((q) => [q.playaId, q]));

    const datos = filas.map(({ playa, municipio, zona, servicios }) => {
      const calidad = calidadPorPlaya.get(playa.id);
      return {
        id: playa.id,
        nombre: playa.nombre,
        slug: playa.slug,
        municipio,
        zona,
        ubicacion: { lat: playa.ubicacion.y, lon: playa.ubicacion.x },
        laguna: playa.laguna,
        mira: playa.mira,
        servicios: {
          socorrista: servicios?.socorrista ?? null,
          perros: servicios?.perros ?? null,
          accesible: servicios?.accesible ?? null,
          aseos: servicios?.aseos ?? null,
          duchas: servicios?.duchas ?? null,
          nudista: servicios?.nudista ?? null,
          suelo: servicios?.suelo ?? null,
          ocupacion: servicios?.ocupacion ?? null,
        },
        calidadAgua: calidad
          ? { temporada: calidad.temporada, calificacion: calidad.calificacion }
          : null,
      };
    });
    c.header("Cache-Control", CACHE_CATALOGO);
    return c.json({ datos: datos.toSorted(porNombre) }, 200);
  });
}
