import { describe, expect, it } from "vitest";

import { calcularOrientacion } from "./orientacion.ts";
import referencia from "./pruebas/costa-referencia.json" with { type: "json" };

// Playas cuya orientación se conoce por la geografía (a qué mar dan y desde qué orilla), no
// por este algoritmo. La costa es la real de OpenStreetMap, recortada a 600 m de cada playa.
// Se exige acertar el sector: el rumbo esperado ± 30°.
const TOLERANCIA = 30;

// Diferencia entre dos rumbos teniendo en cuenta que 359° y 1° están a 2°
const diferencia = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe("calcularOrientacion con playas de referencia", () => {
  it.each(referencia.playas)("$nombre: $motivo", ({ playa, costa, esperado }) => {
    const tramos = costa.map((tramo) => tramo.map(([lon = 0, lat = 0]) => ({ lon, lat })));
    const orientacion = calcularOrientacion(playa, tramos);

    expect(orientacion).not.toBeNull();
    expect(diferencia(orientacion?.mira ?? Number.NaN, esperado)).toBeLessThanOrEqual(TOLERANCIA);
    // Son playas de costa recta: el cálculo tiene que ser fiable
    expect(orientacion?.confianza).toBeGreaterThanOrEqual(0.9);
  });

  it("distingue las dos orillas de La Manga, separadas por unos cientos de metros", () => {
    const [mediterraneo, marMenor] = ["las-gaviotas", "mistral"].map((slug) => {
      const ref = referencia.playas.find((p) => p.slug === slug);
      const tramos = (ref?.costa ?? []).map((t) => t.map(([lon = 0, lat = 0]) => ({ lon, lat })));
      return ref ? calcularOrientacion(ref.playa, tramos)?.mira : undefined;
    });

    expect(diferencia(mediterraneo ?? 0, marMenor ?? 0)).toBeGreaterThan(150);
  });
});

describe("diferencia entre rumbos", () => {
  it("tiene en cuenta el paso por el norte", () => {
    expect(diferencia(352.3, 0)).toBeCloseTo(7.7);
    expect(diferencia(10, 350)).toBe(20);
    expect(diferencia(90, 270)).toBe(180);
  });
});
