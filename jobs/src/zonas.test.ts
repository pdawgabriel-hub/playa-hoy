import { esquema, eq, isNull } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import censo from "../datos/censo-2025-murcia.json" with { type: "json" };
import correcciones from "../datos/correcciones-censo.json" with { type: "json" };
import datosMunicipios from "../datos/municipios.json" with { type: "json" };
import datosZonas from "../datos/zonas.json" with { type: "json" };
import { importarMunicipios, leerMunicipios } from "./municipios.ts";
import { importarPlayasCenso, prepararPlayasCenso } from "./playas-censo.ts";
import { type Zona, importarZonas, leerZonas } from "./zonas.ts";

const BOLNUEVO = "ES620M0261636";
const PERCHELES = "ES620M0262414";

// Zona mínima con una sola playa, para los ficheros incoherentes
const zona = (nombre: string, codigo: string) => ({
  nombre,
  descripcion: "d",
  playas: [{ codigo, nombre: "p" }],
});

describe("leerZonas con el fichero real", () => {
  const zonas = leerZonas(datosZonas);

  it("define las 8 zonas acordadas", () => {
    expect(zonas.map((z) => z.slug)).toEqual([
      "mar-menor",
      "la-manga",
      "calblanque-y-cabo-de-palos",
      "salinas-de-san-pedro",
      "costa-de-cartagena",
      "bahia-de-mazarron",
      "costa-de-lorca",
      "aguilas",
    ]);
  });

  it("reparte las 83 playas del censo, cada una en una sola zona", () => {
    const { playas } = prepararPlayasCenso(
      censo,
      correcciones,
      new Map(leerMunicipios(datosMunicipios).map((m) => [m.id, m.slug])),
    );

    expect(zonas.flatMap((z) => z.codigos).toSorted()).toEqual(
      playas.map((p) => p.codigoCenso).toSorted(),
    );
  });
});

describe("leerZonas rechaza ficheros incoherentes", () => {
  it("una playa en dos zonas", () => {
    const datos = { zonas: [zona("Una", BOLNUEVO), zona("Otra", BOLNUEVO)] };

    expect(() => leerZonas(datos)).toThrow(/está en dos zonas/);
  });

  it("dos zonas con el mismo slug", () => {
    const datos = { zonas: [zona("Águilas", BOLNUEVO), zona("aguilas", PERCHELES)] };

    expect(() => leerZonas(datos)).toThrow(/mismo slug/);
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("importarZonas contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  const zonas = leerZonas(datosZonas);

  const zonaDe = async (codigo: string) => {
    const [fila] = await conexion.db
      .select({ zona: esquema.zonas.slug })
      .from(esquema.playas)
      .leftJoin(esquema.zonas, eq(esquema.zonas.id, esquema.playas.zonaId))
      .where(eq(esquema.playas.codigoCenso, codigo));
    return fila?.zona ?? null;
  };

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const municipios = leerMunicipios(datosMunicipios);
    await importarMunicipios(conexion.db, municipios);
    const slugs = new Map(municipios.map((m) => [m.id, m.slug]));
    await importarPlayasCenso(conexion.db, prepararPlayasCenso(censo, correcciones, slugs).playas);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("crea las zonas y asigna zona a las 83 playas", async () => {
    expect(await importarZonas(conexion.db, zonas)).toEqual({ zonas: 8, playas: 83, borradas: [] });
    expect(await conexion.db.$count(esquema.playas, isNull(esquema.playas.zonaId))).toBe(0);
    expect(await zonaDe(BOLNUEVO)).toBe("bahia-de-mazarron");
  });

  it("repetirlo no cambia nada", async () => {
    expect(await importarZonas(conexion.db, zonas)).toEqual({ zonas: 8, playas: 83, borradas: [] });
    expect(await conexion.db.$count(esquema.zonas)).toBe(8);
  });

  it("mueve una playa de zona si cambia en el fichero", async () => {
    const movida: Zona[] = zonas.map((z) => ({
      ...z,
      codigos:
        z.slug === "bahia-de-mazarron"
          ? [...z.codigos, PERCHELES]
          : z.codigos.filter((c) => c !== PERCHELES),
    }));

    await importarZonas(conexion.db, movida);

    expect(await zonaDe(PERCHELES)).toBe("bahia-de-mazarron");
  });

  it("al quitar una zona, sus playas se quedan sin zona y la zona se borra", async () => {
    const sinLorca = zonas.filter((z) => z.slug !== "costa-de-lorca");

    const resultado = await importarZonas(conexion.db, sinLorca);

    expect(resultado.borradas).toEqual(["costa-de-lorca"]);
    expect(await zonaDe(PERCHELES)).toBeNull();
  });

  it("si una playa no existe, falla y no cambia nada", async () => {
    const conErrata: Zona[] = [
      { nombre: "Nueva", slug: "nueva", descripcion: "d", codigos: ["ES620M9999999"] },
    ];

    await expect(importarZonas(conexion.db, conErrata)).rejects.toThrow(/ES620M9999999/);
    expect(await conexion.db.$count(esquema.zonas, eq(esquema.zonas.slug, "nueva"))).toBe(0);
  });
});
