import { describe, expect, it } from "vitest";

import { crearSlug } from "./slug.ts";

describe("crearSlug", () => {
  it.each([
    ["Águilas", "aguilas"],
    ["San Pedro del Pinatar", "san-pedro-del-pinatar"],
    ["Portmán-El Lastre", "portman-el-lastre"],
    ["La Llana-Las Salinas", "la-llana-las-salinas"],
    ["Playa de la Peñica", "playa-de-la-penica"],
    ["Barco Perdido, Galúa", "barco-perdido-galua"],
    ["Unión (La)", "union-la"],
    ["  Cala   del  Pino ", "cala-del-pino"],
    ["Playa Nº 2", "playa-n-2"],
  ])("%s -> %s", (nombre, slug) => {
    expect(crearSlug(nombre)).toBe(slug);
  });

  it("cumple el formato que exige la base de datos", () => {
    expect(crearSlug("¡Cala  Cortina!")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
