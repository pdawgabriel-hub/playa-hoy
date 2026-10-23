import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import censo from "../datos/censo-2025-murcia.json" with { type: "json" };
import correcciones from "../datos/correcciones-censo.json" with { type: "json" };
import datosMunicipios from "../datos/municipios.json" with { type: "json" };
import { importarMunicipios, leerMunicipios } from "./municipios.ts";
import { importarPlayasCenso, prepararPlayasCenso } from "./playas-censo.ts";

const municipios = leerMunicipios(datosMunicipios);
const slugs = new Map(municipios.map((m) => [m.id, m.slug]));
const zona = (codigo: string, nombre: string, lat = 37.6, lon = -1) => ({
  codigo,
  nombre,
  lat,
  lon,
});

describe("prepararPlayasCenso con el censo 2025", () => {
  const { playas, descartadas } = prepararPlayasCenso(censo, correcciones, slugs);
  const porCodigo = (codigo: string) => playas.find((p) => p.codigoCenso === codigo);

  it("convierte las 85 zonas en 83 playas: descarta los PM2 de Los Urrutias y Los Nietos", () => {
    expect(playas).toHaveLength(83);
    expect(descartadas).toEqual([
      "ES620M0161607 PLAYA LOS NIETOS PM2",
      "ES620M0162095 PLAYA LOS URRUTIAS PM2",
    ]);
  });

  it("limpia los nombres y repone las tildes", () => {
    expect(porCodigo("ES620M0351647")?.nombre).toBe("El Galán");
    expect(porCodigo("ES620M0411659")?.nombre).toBe("Portmán-El Lastre");
    expect(porCodigo("ES620M9021665")?.nombre).toBe("Paseo Carrión");
  });

  it("aplica los nombres corregidos a mano", () => {
    expect(porCodigo("ES620M0161613")?.nombre).toBe("Playa Honda");
    expect(porCodigo("ES620M0161614")).toMatchObject({
      nombre: "Levante (Cabo de Palos)",
      slug: "levante-cabo-de-palos",
    });
  });

  it("corrige las dos coordenadas erróneas del censo", () => {
    expect(porCodigo("ES620M0351644")?.ubicacion).toEqual({ x: -0.729167, y: 37.673611 });
    expect(porCodigo("ES620M0351651")?.ubicacion).toEqual({ x: -0.74239, y: 37.70514 });
  });

  it("saca el municipio del código", () => {
    expect(porCodigo("ES620M9021663")?.municipioId).toBe("30902");
  });

  it("genera slugs únicos", () => {
    expect(new Set(playas.map((p) => p.slug)).size).toBe(playas.length);
  });
});

describe("prepararPlayasCenso con datos de prueba", () => {
  const sinCorrecciones = { tildes: {}, nombres: [], ubicaciones: [] };

  it("añade el municipio al slug de dos playas que se llaman igual", () => {
    const datos = {
      temporada: 2025,
      zonas: [
        zona("ES620M0031", "PLAYA DE LEVANTE PM1"),
        zona("ES620M0161", "PLAYA DE LEVANTE PM1"),
      ],
    };

    const { playas } = prepararPlayasCenso(datos, sinCorrecciones, slugs);

    expect(playas.map((p) => p.slug)).toEqual(["levante-aguilas", "levante-cartagena"]);
  });

  it("rechaza una zona fuera de la costa de Murcia", () => {
    const datos = {
      temporada: 2025,
      zonas: [zona("ES620M0351644", "PLAYA EL TABAL PM1", 37.674, -4.6683)],
    };

    expect(() => prepararPlayasCenso(datos, sinCorrecciones, slugs)).toThrow(/fuera de la costa/);
  });

  it("rechaza una zona de un municipio que no está importado", () => {
    const datos = { temporada: 2025, zonas: [zona("ES620M9991", "PLAYA NUEVA PM1")] };

    expect(() => prepararPlayasCenso(datos, sinCorrecciones, slugs)).toThrow(/no está importado/);
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("importarPlayasCenso contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  const { playas } = prepararPlayasCenso(censo, correcciones, slugs);

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    await importarMunicipios(conexion.db, municipios);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("crea las 83 playas la primera vez", async () => {
    expect(await importarPlayasCenso(conexion.db, playas)).toEqual({ nuevas: 83, actualizadas: 0 });
  });

  it("repetirlo no duplica y no pisa lo que se calcula en otros pasos", async () => {
    const levante = esquema.playas.codigoCenso;
    await conexion.db
      .update(esquema.playas)
      .set({ mira: 90, laguna: true })
      .where(eq(levante, "ES620M0161614"));

    expect(await importarPlayasCenso(conexion.db, playas)).toEqual({ nuevas: 0, actualizadas: 83 });
    const [fila] = await conexion.db
      .select({ mira: esquema.playas.mira, laguna: esquema.playas.laguna })
      .from(esquema.playas)
      .where(eq(levante, "ES620M0161614"));
    expect(fila).toEqual({ mira: 90, laguna: true });
  });
});
