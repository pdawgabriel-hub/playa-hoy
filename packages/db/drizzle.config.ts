import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";
import { defineConfig } from "drizzle-kit";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/esquema",
  out: "./migraciones",
  // Propiedades en camelCase en TypeScript, columnas en snake_case en PostgreSQL
  casing: "snake_case",
  dbCredentials: { url: DATABASE_URL },
  // Las tablas que crea PostGIS (spatial_ref_sys...) no son nuestras: drizzle-kit no las toca
  extensionsFilters: ["postgis"],
  strict: true,
  verbose: true,
});
