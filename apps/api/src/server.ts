import { serve } from "@hono/node-server";
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, esquemaServidor, leerEntorno } from "@playa-hoy/shared";

import { crearApp } from "./app.ts";

const { PORT, DATABASE_URL } = leerEntorno(
  esquemaServidor.extend(esquemaBaseDatos.shape),
  process.env,
);
const { db } = crearDb(DATABASE_URL);

serve({ fetch: crearApp(db).fetch, port: PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port}`);
});
