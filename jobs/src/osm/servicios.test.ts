import { describe, expect, it } from "vitest";

import {
  geometriaPlaya,
  puntoDeServicio,
  serviciosDeEtiquetas,
  tipoDeServicio,
} from "./servicios.ts";

const p = (lon: number, lat: number) => ({ lon, lat });

describe("serviciosDeEtiquetas", () => {
  it("sin etiquetas no se sabe nada (null), no es un no", () => {
    expect(serviciosDeEtiquetas({ natural: "beach" })).toEqual({
      socorrista: null,
      perros: null,
      aseos: null,
      duchas: null,
    });
  });

  it.each([
    [{ supervised: "yes" }, { socorrista: true }],
    [{ supervised: "no" }, { socorrista: false }],
    [{ supervised: "Jul-Aug" }, { socorrista: true }],
    [{ lifeguard: "no" }, { socorrista: false }],
    [{ dog: "leashed" }, { perros: true }],
    [{ dog: "no" }, { perros: false }],
    [
      { toilets: "yes", shower: "no" },
      { aseos: true, duchas: false },
    ],
  ])("%o -> %o", (etiquetas, esperado) => {
    expect(serviciosDeEtiquetas(etiquetas)).toMatchObject(esperado);
  });
});

describe("tipoDeServicio", () => {
  it.each([
    [{ amenity: "toilets" }, "aseos"],
    [{ amenity: "shower" }, "duchas"],
    [{ emergency: "lifeguard" }, "socorrista"],
    [{ emergency: "lifeguard_tower" }, "socorrista"],
    [{ amenity: "bench" }, null],
  ])("%o -> %s", (etiquetas, tipo) => {
    expect(tipoDeServicio(etiquetas)).toBe(tipo);
  });
});

describe("geometriaPlaya", () => {
  it("un way cerrado es un polígono, con coordenadas [lon, lat]", () => {
    const geometry = [p(0, 0), p(1, 0), p(1, 1), p(0, 0)];
    expect(geometriaPlaya({ type: "way", id: 1, geometry })).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    });
  });

  it("un way abierto es una línea", () => {
    expect(geometriaPlaya({ type: "way", id: 1, geometry: [p(0, 0), p(1, 1)] })).toEqual({
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
  });

  it("de una relación toma las líneas exteriores", () => {
    const members = [
      { type: "way", role: "outer", geometry: [p(0, 0), p(1, 0)] },
      { type: "way", role: "inner", geometry: [p(5, 5), p(6, 6)] },
    ];
    expect(geometriaPlaya({ type: "relation", id: 1, members })).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [0, 0],
          [1, 0],
        ],
      ],
    });
  });
});

describe("puntoDeServicio", () => {
  it("usa lat/lon de un nodo o el centro de un way", () => {
    expect(puntoDeServicio({ type: "node", id: 1, lat: 37, lon: -1 })).toEqual({
      lat: 37,
      lon: -1,
    });
    expect(puntoDeServicio({ type: "way", id: 1, center: { lat: 38, lon: -2 } })).toEqual({
      lat: 38,
      lon: -2,
    });
  });
});
