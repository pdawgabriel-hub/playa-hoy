import { defineConfig } from "vitest/config";

// Cada paquete es un proyecto de Vitest con su propio nombre (el del package.json)
// y, si lo necesita, su propio vitest.config.ts.
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/api", "jobs"],
  },
});
