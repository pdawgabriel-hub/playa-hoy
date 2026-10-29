import { crearDb } from "@playa-hoy/db";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { crearApp } from "./app.ts";

// Una base de datos a la que no se puede conectar: las rutas que la consultan fallan
const app = crearApp(crearDb("postgresql://sin-conexion@localhost:1/ninguna").db);

const EsquemaError = z.object({
  error: z.object({
    codigo: z.string(),
    mensaje: z.string(),
    detalles: z
      .array(z.object({ campo: z.string(), en: z.string(), mensaje: z.string() }))
      .optional(),
  }),
});

const pedir = async (ruta: string) => {
  const res = await app.request(ruta);
  return { status: res.status, cuerpo: EsquemaError.parse(await res.json()) };
};

describe("formato común de errores", () => {
  it("un parámetro no válido da 400 con qué falla y por qué, en español", async () => {
    const { status, cuerpo } = await pedir("/v1/playas/cerca?lat=95&lon=-0.98");

    expect(status).toBe(400);
    expect(cuerpo.error.codigo).toBe("parametro_no_valido");
    expect(cuerpo.error.mensaje).toBe("Hay parámetros no válidos");
    expect(cuerpo.error.detalles).toEqual([
      { campo: "lat", en: "query", mensaje: expect.stringMatching(/grande|<=\s*90/i) },
    ]);
  });

  it("un parámetro obligatorio que falta dice Obligatorio, no que recibió NaN", async () => {
    const { cuerpo } = await pedir("/v1/playas/cerca?lat=37.6");

    expect(cuerpo.error.detalles).toEqual([{ campo: "lon", en: "query", mensaje: "Obligatorio" }]);
  });

  it("también en una lista cerrada: sin plan, Obligatorio y no opción inválida", async () => {
    const { cuerpo } = await pedir("/v1/ranking");

    expect(cuerpo.error.detalles).toEqual([{ campo: "plan", en: "query", mensaje: "Obligatorio" }]);
  });

  it("un número mal escrito sí dice que se esperaba un número", async () => {
    const { cuerpo } = await pedir("/v1/playas/cerca?lat=37.6&lon=oeste");

    expect(cuerpo.error.detalles?.[0]?.mensaje).toMatch(/se esperaba número/);
  });

  it("da un detalle por cada parámetro que falla", async () => {
    const { cuerpo } = await pedir("/v1/ranking?plan=pesca&limite=0");

    expect(cuerpo.error.detalles?.map((d) => d.campo).toSorted()).toEqual(["limite", "plan"]);
  });

  it("un parámetro de la ruta también, marcado como param", async () => {
    const { status, cuerpo } = await pedir("/v1/playas/la-azohia/hoy");

    expect(status).toBe(400);
    expect(cuerpo.error.detalles?.[0]).toMatchObject({ campo: "id", en: "param" });
  });

  it("una ruta que no existe da 404 ruta_no_existe", async () => {
    expect(await pedir("/v1/no-existe")).toEqual({
      status: 404,
      cuerpo: { error: { codigo: "ruta_no_existe", mensaje: "No existe la ruta /v1/no-existe" } },
    });
  });

  it("un fallo inesperado da 500 sin detalles internos, y se registra en el servidor", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, cuerpo } = await pedir("/v1/municipios");

    expect(status).toBe(500);
    expect(cuerpo).toEqual({
      error: { codigo: "error_interno", mensaje: "Error interno: inténtalo de nuevo más tarde" },
    });
    expect(JSON.stringify(cuerpo)).not.toMatch(/localhost|postgres|ECONNREFUSED/i);
    expect(registro).toHaveBeenCalled();
    registro.mockRestore();
  });

  it("la especificación documenta el esquema Error y el 400 de las rutas con parámetros", async () => {
    const res = await app.request("/openapi.json");
    const especificacion = z
      .object({
        components: z.object({ schemas: z.record(z.string(), z.unknown()) }),
        paths: z.record(
          z.string(),
          z.object({ get: z.object({ responses: z.record(z.string(), z.unknown()) }) }),
        ),
      })
      .parse(await res.json());

    expect(Object.keys(especificacion.components.schemas)).toContain("Error");
    expect(Object.keys(especificacion.components.schemas)).not.toContain("NoEncontrado");
    for (const ruta of ["/v1/playas", "/v1/playas/cerca", "/v1/ranking", "/v1/playas/{id}/hoy"]) {
      expect(Object.keys(especificacion.paths[ruta]?.get.responses ?? {})).toContain("400");
    }
  });
});
