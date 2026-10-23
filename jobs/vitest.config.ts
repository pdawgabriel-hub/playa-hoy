import { existsSync } from "node:fs";

import { defineProject } from "vitest/config";

// En local, DATABASE_URL sale del .env de la raíz; en el CI la define el workflow.
const env = new URL("../.env", import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);

export default defineProject({
  test: {
    name: "@playa-hoy/jobs",
    // Crear la base de datos de prueba y migrarla tarda unos segundos
    hookTimeout: 60_000,
  },
});
