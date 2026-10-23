import { defineConfig } from "vitest/config";

// Los tests corren en UTC+14, lejos de UTC y de España: si algún código usara la hora local
// de la máquina en lugar de UTC, cambiaría de día y fallaría. Los procesos de los tests
// heredan esta variable.
process.env.TZ = "Pacific/Kiritimati";

// Cada paquete es un proyecto de Vitest con su propio nombre (el del package.json)
// y, si lo necesita, su propio vitest.config.ts.
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/api", "jobs"],
  },
});
