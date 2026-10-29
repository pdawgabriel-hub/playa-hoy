import { crearDb } from "@playa-hoy/db";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { crearApp } from "./app.ts";

// Estas rutas no consultan la base de datos: la conexión es perezosa y nunca se abre
const app = crearApp(crearDb("postgresql://sin-conexion@localhost:1/ninguna").db);

const EsquemaEspecificacion = z.object({
  openapi: z.string(),
  info: z.object({ title: z.string() }),
  paths: z.record(z.string(), z.unknown()),
  components: z.object({ schemas: z.record(z.string(), z.unknown()) }),
});

const especificacion = async () =>
  EsquemaEspecificacion.parse(await (await app.request("/openapi.json")).json());

describe("GET /", () => {
  it("responde que la API está viva y dónde está la especificación", async () => {
    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      nombre: "playa·hoy API",
      estado: "ok",
      especificacion: "/openapi.json",
    });
  });
});

describe("GET /v1/estado", () => {
  it("responde con el estado y la versión de la API", async () => {
    const res = await app.request("/v1/estado");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nombre: "playa·hoy API", estado: "ok", version: "1" });
  });
});

describe("GET /openapi.json", () => {
  it("publica la especificación OpenAPI 3.1 con las rutas declaradas", async () => {
    expect((await app.request("/openapi.json")).status).toBe(200);
    const { openapi, info, paths, components } = await especificacion();

    expect(openapi).toBe("3.1.0");
    expect(info.title).toBe("playa·hoy API");
    expect(Object.keys(paths)).toContain("/v1/estado");
    expect(Object.keys(components.schemas)).toContain("Estado");
  });

  it("la ruta raíz no aparece en la especificación: no forma parte de la API", async () => {
    const { paths } = await especificacion();

    expect(Object.keys(paths)).not.toContain("/");
  });
});

describe("rutas que no existen", () => {
  it("responden 404", async () => {
    expect((await app.request("/v1/no-existe")).status).toBe(404);
  });
});
