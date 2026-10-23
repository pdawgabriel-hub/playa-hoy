import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { importarCosta, prepararTramosCosta } from "./costa.ts";
import type { ElementoOsm } from "./osm/overpass.ts";

const p = (lon: number, lat: number) => ({ lon, lat });

const elementos: ElementoOsm[] = [
  {
    type: "way",
    id: 1,
    tags: { natural: "coastline" },
    geometry: [p(-0.7, 37.6), p(-0.69, 37.61), p(-0.68, 37.62)],
  },
  {
    type: "way",
    id: 2,
    tags: { natural: "coastline" },
    geometry: [p(-0.68, 37.62), p(-0.67, 37.63)],
  },
  // No es costa
  { type: "way", id: 3, tags: { natural: "beach" }, geometry: [p(0, 0), p(1, 1)] },
  // Un solo punto: no es una línea
  { type: "way", id: 4, tags: { natural: "coastline" }, geometry: [p(0, 0)] },
];

describe("prepararTramosCosta", () => {
  it("se queda con los tramos de costa y conserva el orden de los puntos", () => {
    expect(prepararTramosCosta(elementos)).toEqual([
      {
        id: "way/1",
        linea: [
          { x: -0.7, y: 37.6 },
          { x: -0.69, y: 37.61 },
          { x: -0.68, y: 37.62 },
        ],
      },
      {
        id: "way/2",
        linea: [
          { x: -0.68, y: 37.62 },
          { x: -0.67, y: 37.63 },
        ],
      },
    ]);
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("importarCosta contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  const tramos = prepararTramosCosta(elementos);

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("guarda los tramos y los lee en el mismo orden", async () => {
    expect(await importarCosta(conexion.db, tramos)).toEqual({ tramos: 2, puntos: 5 });

    const filas = await conexion.db
      .select({ id: esquema.costa.id, linea: esquema.costa.linea })
      .from(esquema.costa);
    expect(filas.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(tramos);
  });

  it("una nueva descarga sustituye a la anterior", async () => {
    await importarCosta(conexion.db, tramos.slice(1));

    expect(await conexion.db.$count(esquema.costa)).toBe(1);
  });

  it("una respuesta sin tramos no borra la costa guardada", async () => {
    await expect(importarCosta(conexion.db, [])).rejects.toThrow(/No hay tramos/);
    expect(await conexion.db.$count(esquema.costa)).toBe(1);
  });
});
