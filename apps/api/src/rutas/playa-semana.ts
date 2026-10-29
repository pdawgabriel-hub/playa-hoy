// Los próximos días en una playa, resumidos: la mejor franja y la nota máxima de cada plan
import { createRoute, z } from "@hono/zod-openapi";
import type { Db } from "@playa-hoy/db";
import { enHoraEspana } from "@playa-hoy/shared";

import {
  cargarHoras,
  cargarPlaya,
  desdeAhora,
  limitesDelDia,
  resumirDia,
} from "../consultas/dia.ts";
import { EsquemaFranja, EsquemaPlayaBreve, porPlan } from "../esquemas.ts";
import { EsquemaIdPlaya, EsquemaLuz } from "./playa-hoy.ts";
import { EsquemaError, crearRouter, cuerpoError, respuestaError } from "../errores.ts";

// La previsión llega a unos 10 días
const DIAS = 10;
const DIA_MS = 86_400_000;

const EsquemaResumenDia = z
  .object({
    fecha: z.string().openapi({ example: "2026-10-31" }),
    luz: EsquemaLuz,
    franjas: porPlan(EsquemaFranja.nullable()),
    notaMaxima: porPlan(
      z.number().int().nullable().openapi({ description: "La mejor nota de las horas de día" }),
    ),
    condiciones: z
      .object({
        olaOrillaMaxima: z.number().nullable().openapi({ description: "m" }),
        vientoMaximo: z.number().nullable().openapi({ description: "km/h" }),
        rachaMaxima: z.number().nullable().openapi({ description: "km/h" }),
        temperaturaAireMaxima: z.number().nullable(),
        temperaturaAireMinima: z.number().nullable(),
        temperaturaAgua: z
          .number()
          .nullable()
          .openapi({ description: "Media de las horas de día" }),
        banderaPeor: z
          .enum(["verde", "amarilla", "roja"])
          .nullable()
          .openapi({ description: "La bandera probable más alta del día; nula sin socorrista" }),
      })
      .openapi({ description: "De las horas de día" }),
  })
  .openapi("ResumenDia");

const ruta = createRoute({
  method: "get",
  path: "/v1/playas/{id}/semana",
  tags: ["Playas"],
  summary: "Los próximos días en una playa",
  description:
    "Desde hoy hasta donde llega la previsión (unos 10 días), un resumen por día en hora de " +
    "España: la mejor franja y la nota máxima de cada plan, y las condiciones de las horas de " +
    "día. Hoy solo cuenta las horas que quedan, y no aparece si ya no queda ninguna de día. " +
    "El detalle por horas está en /hoy.",
  request: { params: EsquemaIdPlaya },
  responses: {
    400: respuestaError("Parámetros no válidos"),
    200: {
      description: "Los días con previsión",
      content: {
        "application/json": {
          schema: z.object({ playa: EsquemaPlayaBreve, dias: z.array(EsquemaResumenDia) }),
        },
      },
    },
    404: {
      description: "La playa no existe",
      content: { "application/json": { schema: EsquemaError } },
    },
  },
});

export function rutasPlayaSemana(db: Db, { reloj = () => new Date() } = {}) {
  return crearRouter().openapi(ruta, async (c) => {
    const { id } = c.req.valid("param");
    const playa = await cargarPlaya(db, id);
    if (!playa)
      return c.json(cuerpoError("no_encontrado", `No existe la playa ${id.toString()}`), 404);

    const ahora = reloj();
    const hoy = enHoraEspana(ahora).fecha;
    const fechas = Array.from({ length: DIAS }, (_, i) =>
      new Date(Date.parse(`${hoy}T12:00:00Z`) + i * DIA_MS).toISOString().slice(0, 10),
    );
    const desde = desdeAhora(limitesDelDia(hoy).inicio, ahora);
    const hasta = limitesDelDia(fechas.at(-1) ?? hoy).fin;
    const horas = await cargarHoras(db, playa, desde, hasta);
    const porFecha = Map.groupBy(horas, (h) => enHoraEspana(new Date(h.hora)).fecha);

    // Solo los días con previsión y alguna hora de día por delante
    const dias = fechas.flatMap((fecha) => {
      const resumen = resumirDia(playa, porFecha.get(fecha) ?? [], fecha);
      return resumen ? [resumen] : [];
    });
    return c.json({ playa: playa.breve, dias }, 200);
  });
}
