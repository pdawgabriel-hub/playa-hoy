// El día de hoy en una playa: hora a hora y la mejor franja de cada plan
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Db } from "@playa-hoy/db";
import { enHoraEspana } from "@playa-hoy/shared";

import { cargarHoras, cargarPlaya, completarDia, limitesDelDia } from "../consultas/dia.ts";
import {
  EsquemaFranja,
  EsquemaHora,
  EsquemaNoEncontrado,
  EsquemaPlayaBreve,
  porPlan,
} from "../esquemas.ts";

export const EsquemaIdPlaya = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .openapi({ param: { name: "id", in: "path" }, example: 12 }),
});

export const EsquemaLuz = z
  .object({
    orto: z.string(),
    ocaso: z.string(),
    ortoLocal: z.string().openapi({ example: "07:27" }),
    ocasoLocal: z.string().openapi({ example: "18:09" }),
  })
  .nullable()
  .openapi("Luz");

export const EsquemaDia = z
  .object({
    fecha: z
      .string()
      .openapi({ description: "Día del calendario de España", example: "2026-10-30" }),
    luz: EsquemaLuz,
    horas: z.array(EsquemaHora).openapi({
      description: "Las horas con previsión; las de hoy que ya han pasado no aparecen",
    }),
    franjas: porPlan(EsquemaFranja.nullable()).openapi({
      description:
        "Las tres horas seguidas de día con mejor nota; nula si no hay nada que recomendar",
    }),
  })
  .openapi("Dia");

const ruta = createRoute({
  method: "get",
  path: "/v1/playas/{id}/hoy",
  tags: ["Playas"],
  summary: "El día de hoy en una playa",
  description:
    "Hoy en hora de España: condiciones en la orilla, viento, temperaturas y notas de los cuatro " +
    "planes hora a hora, y la mejor franja de tres horas de cada plan.",
  request: { params: EsquemaIdPlaya },
  responses: {
    200: {
      description: "El día en la playa",
      content: {
        "application/json": { schema: EsquemaDia.extend({ playa: EsquemaPlayaBreve }) },
      },
    },
    404: {
      description: "La playa no existe",
      content: { "application/json": { schema: EsquemaNoEncontrado } },
    },
  },
});

export function rutasPlayaHoy(db: Db, { reloj = () => new Date() } = {}) {
  return new OpenAPIHono().openapi(ruta, async (c) => {
    const { id } = c.req.valid("param");
    const playa = await cargarPlaya(db, id);
    if (!playa) return c.json({ error: `No existe la playa ${id.toString()}` }, 404);

    const fecha = enHoraEspana(reloj()).fecha;
    const { inicio, fin } = limitesDelDia(fecha);
    const horas = await cargarHoras(db, playa, inicio, fin);
    return c.json({ playa: playa.breve, fecha, ...completarDia(playa, horas, fecha) }, 200);
  });
}
