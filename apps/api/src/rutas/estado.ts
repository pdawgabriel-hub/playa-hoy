import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const EsquemaEstado = z
  .object({
    nombre: z.string().openapi({ example: "playa·hoy API" }),
    estado: z.literal("ok"),
    version: z.string().openapi({ example: "1" }),
  })
  .openapi("Estado");

const ruta = createRoute({
  method: "get",
  path: "/v1/estado",
  tags: ["Estado"],
  summary: "Comprueba que la API responde",
  responses: {
    200: {
      description: "La API funciona",
      content: { "application/json": { schema: EsquemaEstado } },
    },
  },
});

export const estado = new OpenAPIHono().openapi(ruta, (c) =>
  c.json({ nombre: "playa·hoy API", estado: "ok" as const, version: "1" }, 200),
);
