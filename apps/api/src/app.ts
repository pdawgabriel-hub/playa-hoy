import { OpenAPIHono } from "@hono/zod-openapi";
import type { Db } from "@playa-hoy/db";

import { rutasCatalogo } from "./rutas/catalogo.ts";
import { estado } from "./rutas/estado.ts";
import { rutasPlayaHoy } from "./rutas/playa-hoy.ts";
import { rutasPlayas } from "./rutas/playas.ts";

// La aplicación se crea con la conexión a la base de datos y se exporta sin arrancar, para
// poder testearla con una base de datos temporal y desplegarla en Vercel.
// Cada ruta se declara con esquemas Zod (@hono/zod-openapi): validan la petición y la
// respuesta y, a la vez, generan la especificación OpenAPI de /openapi.json.
// `reloj` permite fijar la hora en los tests.
export function crearApp(db: Db, { reloj = () => new Date() } = {}) {
  const app = new OpenAPIHono();

  app.route("/", estado);
  app.route("/", rutasCatalogo(db));
  app.route("/", rutasPlayas(db));
  app.route("/", rutasPlayaHoy(db, { reloj }));

  app.get("/", (c) =>
    c.json({ nombre: "playa·hoy API", estado: "ok", especificacion: "/openapi.json" }),
  );

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "playa·hoy API",
      version: "1",
      description:
        "Recomendaciones de playas de la Región de Murcia por plan (familia, snorkel, tomar el sol y surf), " +
        "calculadas con la previsión de Open-Meteo y AEMET. Datos: Open-Meteo (CC BY 4.0), © AEMET, " +
        "Ministerio de Sanidad, ITREM y © colaboradores de OpenStreetMap (ODbL).",
      license: { name: "MIT" },
    },
  });

  return app;
}
