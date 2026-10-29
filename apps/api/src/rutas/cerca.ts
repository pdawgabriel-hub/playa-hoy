// Las playas más cercanas a un punto, con PostGIS
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { type Db, esquema } from "@playa-hoy/db";
import { enHoraEspana } from "@playa-hoy/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { EsquemaNota, EsquemaPlayaBreve } from "../esquemas.ts";

const HORA_MS = 3_600_000;
const PLANES = ["familia", "snorkel", "sol", "surf"] as const;

const EsquemaConsulta = z.object({
  lat: z.coerce.number().min(-90).max(90).openapi({ example: 37.6 }),
  lon: z.coerce.number().min(-180).max(180).openapi({ example: -0.98 }),
  radio: z.coerce
    .number()
    .positive()
    .max(200)
    .default(50)
    .openapi({ description: "Radio de búsqueda en km (hasta 200)", example: 50 }),
  limite: z.coerce.number().int().min(1).max(100).default(10).openapi({ example: 10 }),
  plan: z
    .enum(PLANES)
    .optional()
    .openapi({ description: "Si se indica, cada playa lleva su nota de la hora en curso" }),
});

const EsquemaCerca = z
  .object({
    origen: z.object({ lat: z.number(), lon: z.number() }),
    radioKm: z.number(),
    plan: z.enum(PLANES).nullable(),
    hora: z
      .string()
      .nullable()
      .openapi({ description: "UTC; la de las notas, si se pide un plan" }),
    horaLocal: z.string().nullable(),
    playas: z.array(
      z.object({
        playa: EsquemaPlayaBreve,
        distanciaM: z.number().int().openapi({ description: "Distancia en metros", example: 1250 }),
        nota: EsquemaNota.nullable().openapi({
          description: "Nula si no se pide plan o no hay nota",
        }),
      }),
    ),
  })
  .openapi("PlayasCerca");

const ruta = createRoute({
  method: "get",
  path: "/v1/playas/cerca",
  tags: ["Playas"],
  summary: "Las playas más cercanas a un punto",
  description:
    "De la más cercana a la más lejana, dentro del radio. La distancia es en línea recta.",
  request: { query: EsquemaConsulta },
  responses: {
    200: {
      description: "Las playas cercanas",
      content: { "application/json": { schema: EsquemaCerca } },
    },
  },
});

export function rutasCerca(db: Db, { reloj = () => new Date() } = {}) {
  const { playas, municipios, zonas, notas } = esquema;

  return new OpenAPIHono().openapi(ruta, async (c) => {
    const { lat, lon, radio, limite, plan } = c.req.valid("query");
    const punto = sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`;
    // <-> ordena con el índice playas_ubicacion_geography_idx; ST_DWithin filtra por el radio
    const filas = await db
      .select({
        playa: { id: playas.id, nombre: playas.nombre, slug: playas.slug, laguna: playas.laguna },
        municipio: { id: municipios.id, nombre: municipios.nombre, slug: municipios.slug },
        zona: { id: zonas.id, nombre: zonas.nombre, slug: zonas.slug },
        distancia: sql<number>`ST_Distance(${playas.ubicacion}::geography, ${punto})`,
      })
      .from(playas)
      .innerJoin(municipios, eq(municipios.id, playas.municipioId))
      .leftJoin(zonas, eq(zonas.id, playas.zonaId))
      .where(sql`ST_DWithin(${playas.ubicacion}::geography, ${punto}, ${radio * 1000})`)
      .orderBy(sql`${playas.ubicacion}::geography <-> ${punto}`)
      .limit(limite);

    const hora = new Date(Math.floor(reloj().getTime() / HORA_MS) * HORA_MS);
    const notasPorPlaya = new Map<
      number,
      { nota: number; razones: (typeof notas.$inferSelect)["razones"] }
    >();
    if (plan !== undefined && filas.length > 0) {
      const deLaHora = await db
        .select({ playaId: notas.playaId, nota: notas.nota, razones: notas.razones })
        .from(notas)
        .where(
          and(
            eq(notas.perfil, plan),
            eq(notas.hora, hora),
            inArray(
              notas.playaId,
              filas.map((f) => f.playa.id),
            ),
          ),
        );
      for (const n of deLaHora) notasPorPlaya.set(n.playaId, { nota: n.nota, razones: n.razones });
    }

    return c.json(
      {
        origen: { lat, lon },
        radioKm: radio,
        plan: plan ?? null,
        hora: plan === undefined ? null : hora.toISOString(),
        horaLocal: plan === undefined ? null : enHoraEspana(hora).hora,
        playas: filas.map((f) => ({
          playa: { ...f.playa, municipio: f.municipio, zona: f.zona },
          distanciaM: Math.round(f.distancia),
          nota: notasPorPlaya.get(f.playa.id) ?? null,
        })),
      },
      200,
    );
  });
}
