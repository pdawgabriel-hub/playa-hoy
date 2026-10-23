import { describe, expect, it } from "vitest";

import { clasificarSuelo } from "./suelo.ts";

describe("clasificarSuelo", () => {
  // Los 25 valores distintos que aparecen en los datos de ITREM
  it.each([
    ["ARENA FINA Y DORADA", "arena_fina"],
    ["ARENA FINA Y GRIS", "arena_fina"],
    ["ARENA BLANCA Y FINA", "arena_fina"],
    ["ARENA FINA", "arena_fina"],
    ["ARENA MEDIA Y DORADA", "arena"],
    ["ARENA MEDIA Y GRIS", "arena"],
    ["ARENA  MEDIA Y BLANCA", "arena"],
    ["ARENA MEDIA", "arena"],
    ["ARENA GRUESA", "arena"],
    ["ARENA GRUESA Y GRIS", "arena"],
    ["ARENA GRUESA Y DORADA", "arena"],
    ["ARENA MEDIA Y GRAVA", "arena_y_grava"],
    ["ARENA FINA Y GRAVA", "arena_y_grava"],
    ["ARENA GRUESA Y GRAVA", "arena_y_grava"],
    ["ARENA FINA Y BOLOS", "arena_y_grava"],
    ["ARENA GRUESA Y BOLOS", "arena_y_grava"],
    ["ARENA GRUESA, GRAVA Y BOLOS", "arena_y_grava"],
    ["GRAVA", "grava"],
    ["GRAVA Y BOLOS", "grava"],
    ["BOLOS", "bolos"],
    ["BOLOS Y PIEDRAS", "bolos"],
    ["BOLOS Y ROCA", "bolos"],
    ["PIEDRAS Y ROCA", "roca"],
    ["ROCA", "roca"],
    ["SIN DETERMINAR", null],
  ])("%s -> %s", (descripcion, suelo) => {
    expect(clasificarSuelo(descripcion)).toBe(suelo);
  });

  it("devuelve null con un texto vacío o desconocido", () => {
    expect(clasificarSuelo("")).toBeNull();
    expect(clasificarSuelo("LODO")).toBeNull();
  });
});
