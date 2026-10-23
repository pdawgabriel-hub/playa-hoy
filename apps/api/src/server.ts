import { serve } from "@hono/node-server";
import { esquemaServidor, leerEntorno } from "@playa-hoy/shared";

import { app } from "./app.ts";

const { PORT } = leerEntorno(esquemaServidor, process.env);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port}`);
});
