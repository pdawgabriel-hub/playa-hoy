import type { Db } from "@playa-hoy/db";

import { CACHE_CATALOGO, SIN_CACHE } from "./cache.ts";
import { crearRouter, cuerpoError } from "./errores.ts";
import { rutasCatalogo } from "./rutas/catalogo.ts";
import { rutasCerca } from "./rutas/cerca.ts";
import { estado } from "./rutas/estado.ts";
import { rutasPlayaHoy } from "./rutas/playa-hoy.ts";
import { rutasPlayaSemana } from "./rutas/playa-semana.ts";
import { rutasRanking } from "./rutas/ranking.ts";
import { rutasPlayas } from "./rutas/playas.ts";

// La aplicación se crea con la conexión a la base de datos y se exporta sin arrancar, para
// poder testearla con una base de datos temporal y desplegarla en Vercel.
// Cada ruta se declara con esquemas Zod (@hono/zod-openapi): validan la petición y la
// respuesta y, a la vez, generan la especificación OpenAPI de /openapi.json.
// `reloj` permite fijar la hora en los tests.
export function crearApp(db: Db, { reloj = () => new Date() } = {}) {
  const app = crearRouter();

  // Cada ruta dice cuánto se puede cachear su respuesta; lo que no lo diga (errores, estado)
  // no se guarda nunca
  app.use("*", async (c, next) => {
    await next();
    if (!c.res.headers.has("Cache-Control")) c.res.headers.set("Cache-Control", SIN_CACHE);
  });
  // La especificación solo cambia con cada despliegue
  app.use("/openapi.json", async (c, next) => {
    await next();
    c.res.headers.set("Cache-Control", CACHE_CATALOGO);
  });

  app.route("/", estado);
  app.route("/", rutasCatalogo(db));
  app.route("/", rutasPlayas(db));
  app.route("/", rutasCerca(db, { reloj }));
  app.route("/", rutasPlayaHoy(db, { reloj }));
  app.route("/", rutasPlayaSemana(db, { reloj }));
  app.route("/", rutasRanking(db, { reloj }));

  app.get("/", (c) =>
    c.json({ nombre: "playa·hoy API", estado: "ok", especificacion: "/openapi.json" }),
  );

  app.notFound((c) =>
    c.json(cuerpoError("ruta_no_existe", `No existe la ruta ${c.req.path}`), 404),
  );

  // Un fallo inesperado (la base de datos no responde…) no debe enseñar detalles internos a
  // quien llama: el error completo va al registro del servidor
  app.onError((error, c) => {
    console.error(error);
    return c.json(cuerpoError("error_interno", "Error interno: inténtalo de nuevo más tarde"), 500);
  });

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
