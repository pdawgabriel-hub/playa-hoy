// Acceso a PostgreSQL con PostGIS mediante Drizzle.
export * from "./cliente.ts";
export * from "./geo.ts";
export * as esquema from "./esquema/index.ts";
// Los operadores de consulta, desde aquí: así quien consulta usa la misma copia de drizzle-orm
// que el esquema. Con dos copias (pnpm crea una por cada combinación de dependencias peer),
// los tipos no encajan y en ejecución serían módulos distintos.
export { type SQL, and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
