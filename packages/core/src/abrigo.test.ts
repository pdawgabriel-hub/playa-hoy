import { describe, expect, it } from "vitest";

import { type Alcance, abanicoDeRayos, calcularAbrigo } from "./abrigo.ts";

// Alcances del abanico de una playa que mira al este, con la distancia que da `distancia`
const alcances = (distancia: (desvio: number) => number): Alcance[] =>
  abanicoDeRayos(90).map((azimut) => ({ azimut, distanciaM: distancia(azimut - 90) }));

describe("abanicoDeRayos", () => {
  it("cubre de mira - 90° a mira + 90° cada 5°: 37 rayos", () => {
    const rayos = abanicoDeRayos(90);

    expect(rayos).toHaveLength(37);
    expect(rayos[0]).toBe(0);
    expect(rayos.at(-1)).toBe(180);
  });

  it("da la vuelta por el norte", () => {
    expect(abanicoDeRayos(10, 45)).toEqual([280, 325, 10, 55, 100]);
  });
});

describe("calcularAbrigo", () => {
  it("mar abierto en todo el abanico: 0, totalmente expuesta", () => {
    expect(
      calcularAbrigo(
        90,
        alcances(() => 50_000),
      ),
    ).toBe(0);
  });

  it("tierra muy cerca en todo el abanico: casi 1, cerrada", () => {
    expect(
      calcularAbrigo(
        90,
        alcances(() => 300),
      ),
    ).toBe(0.99);
  });

  it("una laguna de 10 km: abrigada pero no cerrada", () => {
    expect(
      calcularAbrigo(
        90,
        alcances(() => 10_000),
      ),
    ).toBe(0.67);
  });

  it("una bahía, con cabos a los lados y mar abierto de frente, abriga a medias", () => {
    const bahia = calcularAbrigo(
      90,
      alcances((desvio) => (Math.abs(desvio) <= 30 ? 50_000 : 2000)),
    );

    expect(bahia).toBeGreaterThan(0.2);
    expect(bahia).toBeLessThan(0.6);
  });

  it("tapar el frente abriga más que tapar los lados", () => {
    const frenteTapado = calcularAbrigo(
      90,
      alcances((d) => (Math.abs(d) <= 30 ? 2000 : 50_000)),
    );
    const ladosTapados = calcularAbrigo(
      90,
      alcances((d) => (Math.abs(d) > 60 ? 2000 : 50_000)),
    );

    expect(frenteTapado).toBeGreaterThan(ladosTapados ?? 1);
  });

  it("sin alcances no se sabe", () => {
    expect(calcularAbrigo(90, [])).toBeNull();
  });
});
