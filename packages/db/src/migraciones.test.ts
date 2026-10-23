import { sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as esquema from "./esquema/index.ts";
import { carpetaMigraciones, crearBaseDatosPrueba } from "./pruebas.ts";

const url = process.env.DATABASE_URL ?? "";

// Contra PostgreSQL real: el Docker local (pnpm db:up) o el servicio del CI.
// Cada ejecución crea su propia base de datos vacía y la borra al terminar.
describe.skipIf(!url)("migraciones contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("activa PostGIS en una base de datos que no lo tenía", async () => {
    const filas = await conexion.db.execute<{ extname: string }>(
      sql`SELECT extname FROM pg_extension WHERE extname = 'postgis'`,
    );

    expect(filas).toHaveLength(1);
  });

  it("la sesión trabaja en UTC, sea cual sea la zona del servidor", async () => {
    const [fila] = await conexion.db.execute<{ zona: string; dia: string }>(
      sql`SELECT current_setting('TimeZone') AS zona,
                 ('2026-10-23T23:30:00Z'::timestamptz)::date::text AS dia`,
    );

    expect(fila).toEqual({ zona: "UTC", dia: "2026-10-23" });
  });

  it("crea todas las tablas del esquema", async () => {
    const esperadas = Object.values(esquema)
      .map((tabla) => getTableConfig(tabla).name)
      .toSorted();
    const filas = await conexion.db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'spatial_ref_sys'`,
    );

    expect(filas.map((f) => f.table_name).toSorted()).toEqual(esperadas);
  });

  it("guarda y lee un punto con SRID 4326", async () => {
    const { db } = conexion;
    await db
      .insert(esquema.municipios)
      .values({ id: "30016", nombre: "Cartagena", slug: "cartagena" });
    await db.insert(esquema.playas).values({
      nombre: "Levante",
      slug: "levante-cabo-de-palos",
      municipioId: "30016",
      ubicacion: { x: -0.6987, y: 37.6329 },
      codigoCenso: "ES620M0161614",
    });

    const [playa] = await db
      .select({
        ubicacion: esquema.playas.ubicacion,
        srid: sql<number>`ST_SRID(${esquema.playas.ubicacion})`,
      })
      .from(esquema.playas);

    expect(playa).toEqual({ ubicacion: { x: -0.6987, y: 37.6329 }, srid: 4326 });
  });

  it("rechaza una playa que no viene del censo ni de OpenStreetMap", async () => {
    const insertar = conexion.db.insert(esquema.playas).values({
      nombre: "Inventada",
      slug: "inventada",
      municipioId: "30016",
      ubicacion: { x: -0.7, y: 37.6 },
    });

    // Drizzle envuelve el error de PostgreSQL: la restricción que salta va en cause
    await expect(insertar).rejects.toMatchObject({ cause: { constraint_name: "playas_origen" } });
  });

  it("aplicar las migraciones otra vez no cambia nada", async () => {
    const contar = async () =>
      (await conexion.db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations`)).length;
    const antes = await contar();

    await migrate(conexion.db, { migrationsFolder: carpetaMigraciones });

    expect(await contar()).toBe(antes);
  });
});
