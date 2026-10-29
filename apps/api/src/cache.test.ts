import { crearDb } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { crearApp } from "./app.ts";
import { segundosHastaCambio } from "./cache.ts";

const a = (hora: string) => new Date(`2026-07-15T${hora}Z`);

describe("segundosHastaCambio", () => {
  it("justo tras una ingesta, hasta que el workflow deja las notas nuevas (15 min después)", () => {
    expect(segundosHastaCambio(a("06:05:00"))).toBe(10 * 60);
    expect(segundosHastaCambio(a("18:10:00"))).toBe(5 * 60);
  });

  it("con las notas ya nuevas, hasta la siguiente hora en punto", () => {
    expect(segundosHastaCambio(a("06:20:00"))).toBe(40 * 60);
    expect(segundosHastaCambio(a("09:30:00"))).toBe(30 * 60);
  });

  it("de noche cruza el día: a las 23:30, hasta las 00:00", () => {
    expect(segundosHastaCambio(a("23:30:00"))).toBe(30 * 60);
  });

  it("nunca menos de un minuto", () => {
    expect(segundosHastaCambio(a("05:59:50"))).toBe(60);
  });
});

// Rutas que no consultan la base de datos, o que fallan por no poder conectarse
const sinBase = crearApp(crearDb("postgresql://sin-conexion@localhost:1/ninguna").db);
const cabecera = async (app: ReturnType<typeof crearApp>, ruta: string) =>
  (await app.request(ruta)).headers.get("Cache-Control");

describe("cabeceras de caché", () => {
  it("el estado, los errores y las rutas que no existen no se guardan nunca", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await cabecera(sinBase, "/v1/estado")).toBe("no-store");
    expect(await cabecera(sinBase, "/v1/no-existe")).toBe("no-store");
    expect(await cabecera(sinBase, "/v1/ranking?plan=pesca")).toBe("no-store");
    // La base de datos no responde: 500
    expect(await cabecera(sinBase, "/v1/municipios")).toBe("no-store");
    registro.mockRestore();
  });

  it("la especificación, como el catálogo", async () => {
    expect(await cabecera(sinBase, "/openapi.json")).toMatch(
      /^public, max-age=3600, s-maxage=86400/,
    );
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("cabeceras de caché contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let app: ReturnType<typeof crearApp>;

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    // A las 06:05 UTC: las notas pueden cambiar a las 06:15
    app = crearApp(conexion.db, { reloj: () => a("06:05:00") });
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("el catálogo, una hora en el navegador y un día en Vercel", async () => {
    for (const ruta of [
      "/v1/municipios",
      "/v1/zonas",
      "/v1/playas",
      "/v1/playas/cerca?lat=37.6&lon=-0.98",
    ]) {
      expect(await cabecera(app, ruta)).toBe(
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
      );
    }
  });

  it("lo que depende de las notas, hasta el siguiente cambio", async () => {
    const hastaLas0615 = "public, max-age=600, s-maxage=600, stale-while-revalidate=60";

    expect(await cabecera(app, "/v1/ranking?plan=familia")).toBe(hastaLas0615);
    expect(await cabecera(app, "/v1/playas/cerca?lat=37.6&lon=-0.98&plan=sol")).toBe(hastaLas0615);
  });
});
