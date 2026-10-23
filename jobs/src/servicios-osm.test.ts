import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ElementoOsm } from "./osm/overpass.ts";
import { importarServiciosOsm, prepararDatosOsm } from "./servicios-osm.ts";

// Bolnuevo según el censo: 37.5612, -1.304. Un polígono de playa a su alrededor, un aseo a
// unos 60 m y una ducha a unos 900 m (demasiado lejos).
const BOLNUEVO = { lat: 37.5612, lon: -1.304 };
const cuadrado = (d: number) =>
  [
    [-d, -d],
    [d, -d],
    [d, d],
    [-d, d],
    [-d, -d],
  ].map(([x = 0, y = 0]) => ({ lat: BOLNUEVO.lat + y, lon: BOLNUEVO.lon + x }));

const elementos: ElementoOsm[] = [
  {
    type: "way",
    id: 1,
    tags: { natural: "beach", supervised: "yes", dog: "no" },
    geometry: cuadrado(0.0005),
  },
  {
    type: "node",
    id: 2,
    tags: { amenity: "toilets" },
    lat: BOLNUEVO.lat + 0.001,
    lon: BOLNUEVO.lon,
  },
  {
    type: "node",
    id: 3,
    tags: { amenity: "shower" },
    lat: BOLNUEVO.lat + 0.008,
    lon: BOLNUEVO.lon,
  },
];

describe("prepararDatosOsm", () => {
  it("separa las playas y los servicios", () => {
    const { playas, servicios } = prepararDatosOsm(elementos);

    expect(playas).toHaveLength(1);
    expect(playas[0]).toMatchObject({ id: "way/1", socorrista: true, perros: false, aseos: null });
    expect(servicios.map((s) => s.tipo)).toEqual(["aseos", "duchas"]);
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("importarServiciosOsm contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let bolnuevo = 0;

  const leer = async () => {
    const [fila] = await conexion.db
      .select()
      .from(esquema.playaServicios)
      .where(eq(esquema.playaServicios.playaId, bolnuevo));
    return fila;
  };

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    await conexion.db
      .insert(esquema.municipios)
      .values({ id: "30026", nombre: "Mazarrón", slug: "mazarron" });
    const [playa] = await conexion.db
      .insert(esquema.playas)
      .values({
        nombre: "Bolnuevo",
        slug: "bolnuevo",
        municipioId: "30026",
        ubicacion: { x: BOLNUEVO.lon, y: BOLNUEVO.lat },
        codigoCenso: "ES620M0261636",
      })
      .returning({ id: esquema.playas.id });
    bolnuevo = playa?.id ?? 0;
    // Datos de ITREM que el import de OSM no debe tocar
    await conexion.db
      .insert(esquema.playaServicios)
      .values({ playaId: bolnuevo, accesible: true, suelo: "arena", fuentes: ["itrem"] });
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("asigna las etiquetas de la playa y los servicios cercanos, sin deducir noes", async () => {
    expect(await importarServiciosOsm(conexion.db, prepararDatosOsm(elementos))).toEqual({
      playasConDatos: 1,
    });

    expect(await leer()).toMatchObject({
      socorrista: true,
      perros: false,
      aseos: true,
      // La ducha está a 900 m: no cuenta, y su ausencia no es un false
      duchas: null,
      accesible: true,
      suelo: "arena",
      fuentes: ["itrem", "osm"],
    });
  });

  it("si OSM deja de tener datos, se borran los suyos y se conservan los de ITREM", async () => {
    expect(await importarServiciosOsm(conexion.db, prepararDatosOsm([]))).toEqual({
      playasConDatos: 0,
    });

    expect(await leer()).toMatchObject({
      socorrista: null,
      perros: null,
      aseos: null,
      duchas: null,
      accesible: true,
      fuentes: ["itrem"],
    });
  });
});
