import { describe, expect, it } from "vitest";

import { type Coordenadas, calcularOrientacion } from "./orientacion.ts";

const PLAYA: Coordenadas = { lon: -0.7, lat: 37.6 };

// Construye una línea de costa a partir de puntos en metros respecto a la playa
// (x hacia el este, y hacia el norte), en el orden en que se dibuja.
function costa(...puntos: [number, number][]): Coordenadas[] {
  const metrosPorGradoLat = 111_195;
  const metrosPorGradoLon = metrosPorGradoLat * Math.cos((PLAYA.lat * Math.PI) / 180);
  return puntos.map(([x, y]) => ({
    lon: PLAYA.lon + x / metrosPorGradoLon,
    lat: PLAYA.lat + y / metrosPorGradoLat,
  }));
}

describe("calcularOrientacion con costas rectas", () => {
  // La playa está a 20 m de la orilla, en tierra. El mar queda a la derecha de la línea.
  it.each([
    ["de sur a norte: el mar al este", costa([20, -200], [20, 200]), 90],
    ["de norte a sur: el mar al oeste", costa([-20, 200], [-20, -200]), 270],
    ["de oeste a este: el mar al sur", costa([-200, -20], [200, -20]), 180],
    ["de este a oeste: el mar al norte", costa([200, 20], [-200, 20]), 0],
    ["de suroeste a noreste: el mar al sureste", costa([-150, -170], [170, 150]), 135],
  ])("%s", (_, linea, mira) => {
    expect(calcularOrientacion(PLAYA, [linea])).toEqual({ mira, confianza: 1 });
  });

  it("invertir el sentido de la línea gira la orientación 180°", () => {
    const linea = costa([20, -200], [20, 200]);

    expect(calcularOrientacion(PLAYA, [linea.toReversed()])?.mira).toBe(270);
  });
});

describe("calcularOrientacion con costas reales", () => {
  it("suaviza una costa en zigzag que en conjunto va de sur a norte", () => {
    const linea = costa([20, -200], [40, -100], [10, 0], [45, 100], [20, 200]);
    const orientacion = calcularOrientacion(PLAYA, [linea]);

    expect(Math.abs((orientacion?.mira ?? 0) - 90)).toBeLessThan(5);
    expect(orientacion?.confianza).toBeGreaterThan(0.9);
  });

  it("en la punta de un cabo da una orientación intermedia con menos confianza", () => {
    // La costa sube hacia el norte y gira hacia el este justo en la playa
    const orientacion = calcularOrientacion(PLAYA, [costa([0, -200], [0, 0], [200, 0])]);

    expect(orientacion).toEqual({ mira: 135, confianza: 0.71 });
  });

  it("une tramos distintos de la misma costa", () => {
    const tramos = [costa([20, -200], [20, 0]), costa([20, 0], [20, 200])];

    expect(calcularOrientacion(PLAYA, tramos)).toEqual({ mira: 90, confianza: 1 });
  });

  it("en una franja estrecha (La Manga) no mezcla la orilla de enfrente", () => {
    // Orilla del Mediterráneo a 20 m (mar al este) y orilla del Mar Menor a 130 m al oeste,
    // dibujada en sentido contrario (mar al oeste). No están unidas por la línea.
    const mediterraneo = costa([20, -300], [20, 300]);
    const marMenor = costa([-130, 300], [-130, -300]);

    expect(calcularOrientacion(PLAYA, [mediterraneo, marMenor])).toEqual({
      mira: 90,
      confianza: 1,
    });
  });

  it("solo tiene en cuenta unos 150 m de costa a cada lado", () => {
    // Recta junto a la playa; a 400 m al norte la costa gira hacia el oeste
    const linea = costa([20, -200], [20, 200], [-500, 400]);

    expect(calcularOrientacion(PLAYA, [linea])).toEqual({ mira: 90, confianza: 1 });
  });

  it("no da vueltas en una isla (tramo cerrado)", () => {
    // Isla recorrida en sentido antihorario: el mar queda fuera, a la derecha
    const isla = costa([20, -50], [20, 50], [-80, 50], [-80, -50], [20, -50]);

    expect(calcularOrientacion(PLAYA, [isla])?.mira).toBeDefined();
  });
});

describe("calcularOrientacion sin costa cerca", () => {
  it("devuelve null en lugar de inventar una orientación", () => {
    expect(calcularOrientacion(PLAYA, [])).toBeNull();
    expect(calcularOrientacion(PLAYA, [costa([1000, -200], [1000, 200])])).toBeNull();
    expect(calcularOrientacion(PLAYA, [costa([0, 0])])).toBeNull();
  });

  it("con una distancia máxima mayor sí encuentra la costa lejana", () => {
    const lejana = costa([1000, -200], [1000, 200]);

    expect(calcularOrientacion(PLAYA, [lejana], { distanciaMaximaM: 1500 })?.mira).toBe(90);
  });
});

describe("calcularOrientacion: formato del resultado", () => {
  it("redondea a una décima sin errores de coma flotante", () => {
    const orientacion = calcularOrientacion(PLAYA, [costa([20, -200], [22.1, 200])]);

    expect(String(orientacion?.mira)).toMatch(/^\d+(\.\d)?$/);
  });

  it("el rumbo está siempre en [0, 360)", () => {
    // Casi de este a oeste: el rumbo ronda 0 y no debe salir 360
    const orientacion = calcularOrientacion(PLAYA, [costa([200, 20], [-200, 19.9])]);

    expect(orientacion?.mira).toBeGreaterThanOrEqual(0);
    expect(orientacion?.mira).toBeLessThan(360);
  });
});
