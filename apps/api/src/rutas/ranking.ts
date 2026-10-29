// Las mejores playas para un plan a una hora, en una zona o en toda la costa
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { type Db, esquema } from "@playa-hoy/db";
import { enHoraEspana } from "@playa-hoy/shared";
import { type SQL, and, eq } from "drizzle-orm";

import { porNombre } from "../comun.ts";
import { EsquemaNoEncontrado, EsquemaPlayaBreve, EsquemaRazon } from "../esquemas.ts";

const HORA_MS = 3_600_000;
const PLANES = ["familia", "snorkel", "sol", "surf"] as const;

const EsquemaConsulta = z.object({
  plan: z.enum(PLANES).openapi({ description: "Plan", example: "familia" }),
  hora: z.iso.datetime({ offset: true }).optional().openapi({
    description: "Hora, con zona horaria (ISO 8601). Por defecto, la hora en curso",
    example: "2026-07-15T12:00:00+02:00",
  }),
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .openapi({ description: "Cuántas playas como máximo", example: 10 }),
});

const EsquemaPuesto = z
  .object({
    posicion: z.number().int().openapi({ example: 1 }),
    playa: EsquemaPlayaBreve,
    nota: z.number().int().min(0).max(100),
    razones: z.array(EsquemaRazon),
    olaOrilla: z.number().nullable().openapi({ description: "m" }),
    estadoAgua: z.enum(["cristalina", "buena", "turbia"]).nullable(),
    bandera: z
      .enum(["verde", "amarilla", "roja"])
      .nullable()
      .openapi({ description: "Bandera probable; nula si la playa no tiene socorrista" }),
  })
  .openapi("PuestoRanking");

const EsquemaRanking = z
  .object({
    zona: z.object({ id: z.number().int(), nombre: z.string(), slug: z.string() }).nullable(),
    plan: z.enum(PLANES),
    hora: z.string().openapi({ description: "UTC" }),
    horaLocal: z.string().openapi({ description: "Hora de España", example: "12:00" }),
    playas: z.array(EsquemaPuesto).openapi({
      description: "De mejor a peor nota; vacío si no hay notas a esa hora (fuera de la previsión)",
    }),
  })
  .openapi("Ranking");

const respuesta = {
  description: "El ranking",
  content: { "application/json": { schema: EsquemaRanking } },
};

const rutaZona = createRoute({
  method: "get",
  path: "/v1/zonas/{id}/ranking",
  tags: ["Ranking"],
  summary: "Las mejores playas de una zona para un plan a una hora",
  request: {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .openapi({ param: { name: "id", in: "path" }, example: 1 }),
    }),
    query: EsquemaConsulta,
  },
  responses: {
    200: respuesta,
    404: {
      description: "La zona no existe",
      content: { "application/json": { schema: EsquemaNoEncontrado } },
    },
  },
});

const rutaCosta = createRoute({
  method: "get",
  path: "/v1/ranking",
  tags: ["Ranking"],
  summary: "Las mejores playas de toda la costa para un plan a una hora",
  request: { query: EsquemaConsulta },
  responses: { 200: respuesta },
});

type Consulta = z.infer<typeof EsquemaConsulta>;

// La hora en punto de la consulta: la pedida o la en curso
const horaEnPunto = (hora: string | undefined, ahora: Date) =>
  new Date(Math.floor((hora === undefined ? ahora : new Date(hora)).getTime() / HORA_MS) * HORA_MS);

async function ranking(
  db: Db,
  zonaId: number | null,
  { plan, hora: pedida, limite }: Consulta,
  ahora: Date,
) {
  const { notas, playas, municipios, zonas, condiciones, playaServicios } = esquema;
  const hora = horaEnPunto(pedida, ahora);
  const filtros: SQL[] = [eq(notas.perfil, plan), eq(notas.hora, hora)];
  if (zonaId !== null) filtros.push(eq(playas.zonaId, zonaId));

  const filas = await db
    .select({
      nota: notas.nota,
      razones: notas.razones,
      playa: { id: playas.id, nombre: playas.nombre, slug: playas.slug, laguna: playas.laguna },
      municipio: { id: municipios.id, nombre: municipios.nombre, slug: municipios.slug },
      zona: { id: zonas.id, nombre: zonas.nombre, slug: zonas.slug },
      olaOrilla: condiciones.olaOrilla,
      estadoAgua: condiciones.estadoAgua,
      bandera: condiciones.bandera,
      socorrista: playaServicios.socorrista,
    })
    .from(notas)
    .innerJoin(playas, eq(playas.id, notas.playaId))
    .innerJoin(municipios, eq(municipios.id, playas.municipioId))
    .leftJoin(zonas, eq(zonas.id, playas.zonaId))
    .leftJoin(
      condiciones,
      and(eq(condiciones.playaId, notas.playaId), eq(condiciones.hora, notas.hora)),
    )
    .leftJoin(playaServicios, eq(playaServicios.playaId, notas.playaId))
    .where(and(...filtros));

  // De mejor a peor nota y, a igual nota, por orden alfabético; el límite, después
  const ordenadas = filas.toSorted((a, b) => b.nota - a.nota || porNombre(a.playa, b.playa));
  return {
    plan,
    hora: hora.toISOString(),
    horaLocal: enHoraEspana(hora).hora,
    playas: ordenadas.slice(0, limite).map((f, i) => ({
      posicion: i + 1,
      playa: { ...f.playa, municipio: f.municipio, zona: f.zona },
      nota: f.nota,
      razones: f.razones,
      olaOrilla: f.olaOrilla,
      estadoAgua: f.estadoAgua,
      bandera: f.socorrista === true ? f.bandera : null,
    })),
  };
}

export function rutasRanking(db: Db, { reloj = () => new Date() } = {}) {
  return new OpenAPIHono()
    .openapi(rutaZona, async (c) => {
      const { id } = c.req.valid("param");
      const [zona] = await db
        .select({ id: esquema.zonas.id, nombre: esquema.zonas.nombre, slug: esquema.zonas.slug })
        .from(esquema.zonas)
        .where(eq(esquema.zonas.id, id));
      if (!zona) return c.json({ error: `No existe la zona ${id.toString()}` }, 404);
      return c.json({ zona, ...(await ranking(db, zona.id, c.req.valid("query"), reloj())) }, 200);
    })
    .openapi(rutaCosta, async (c) =>
      c.json({ zona: null, ...(await ranking(db, null, c.req.valid("query"), reloj())) }, 200),
    );
}
