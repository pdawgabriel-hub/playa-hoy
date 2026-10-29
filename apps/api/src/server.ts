import { serve } from "@hono/node-server";
import { crearDb } from "@playa-hoy/db";
import {
  esquemaBaseDatos,
  esquemaLimitador,
  esquemaServidor,
  leerEntorno,
} from "@playa-hoy/shared";

import { crearApp } from "./app.ts";
import { crearLimitadorUpstash } from "./limitador.ts";

const { PORT, DATABASE_URL } = leerEntorno(
  esquemaServidor.extend(esquemaBaseDatos.shape),
  process.env,
);
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = leerEntorno(
  esquemaLimitador,
  process.env,
);
const { db } = crearDb(DATABASE_URL);

const limitador =
  UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
    ? crearLimitadorUpstash(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
    : undefined;
if (!limitador) console.warn("Sin variables de Upstash: la API no limita las peticiones");

serve({ fetch: crearApp(db, { limitador }).fetch, port: PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port}`);
});
