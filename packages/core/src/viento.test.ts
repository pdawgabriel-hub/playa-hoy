import { describe, expect, it } from "vitest";

import { entradaViento } from "./viento.ts";

// Una playa que mira al este, como las de La Manga hacia el Mediterráneo
const ESTE = 90;
const MODERADO = 20;

describe("entradaViento", () => {
  it("en una playa que mira al este, el levante es de mar y el poniente de tierra", () => {
    expect(entradaViento(ESTE, 90, MODERADO)).toEqual({ entrada: "mar", haciaTierra: 1 });
    expect(entradaViento(ESTE, 270, MODERADO)).toEqual({ entrada: "tierra", haciaTierra: -1 });
  });

  it("la tramontana y el mediodía le llegan de lado", () => {
    expect(entradaViento(ESTE, 0, MODERADO)).toEqual({ entrada: "lado", haciaTierra: 0 });
    expect(entradaViento(ESTE, 180, MODERADO)).toEqual({ entrada: "lado", haciaTierra: 0 });
  });

  it("un gregal a 45° de la orilla sigue siendo de mar, con menos fuerza hacia tierra", () => {
    expect(entradaViento(ESTE, 45, MODERADO)).toEqual({ entrada: "mar", haciaTierra: 0.71 });
  });

  it("acierta al cruzar el norte", () => {
    // Una playa que mira al norte y un viento del noroeste (350°)
    expect(entradaViento(10, 350, MODERADO)?.entrada).toBe("mar");
  });

  it("los cortes están en 60° (aún de mar) y 120° (ya de tierra)", () => {
    expect(entradaViento(ESTE, ESTE + 60, MODERADO)?.entrada).toBe("mar");
    expect(entradaViento(ESTE, ESTE + 61, MODERADO)?.entrada).toBe("lado");
    expect(entradaViento(ESTE, ESTE + 119, MODERADO)?.entrada).toBe("lado");
    expect(entradaViento(ESTE, ESTE + 120, MODERADO)?.entrada).toBe("tierra");
  });

  it("da igual que el viento llegue por la izquierda o por la derecha", () => {
    for (let desvio = 0; desvio <= 180; desvio += 5) {
      expect(entradaViento(ESTE, ESTE + desvio, MODERADO)).toEqual(
        entradaViento(ESTE, ESTE - desvio, MODERADO),
      );
    }
  });

  it("haciaTierra baja siempre de 1 a -1 al alejarse de la orientación", () => {
    const valores = Array.from(
      { length: 37 },
      (_, i) => entradaViento(ESTE, ESTE + i * 5, MODERADO)?.haciaTierra ?? 0,
    );

    expect(valores[0]).toBe(1);
    expect(valores.at(-1)).toBe(-1);
    expect(valores.every((v, i) => i === 0 || v <= (valores[i - 1] ?? 1))).toBe(true);
  });

  it("por debajo de 6 km/h es calma, venga de donde venga", () => {
    expect(entradaViento(ESTE, 90, 5.9)).toEqual({ entrada: "calma", haciaTierra: 0 });
    expect(entradaViento(ESTE, 270, 0)).toEqual({ entrada: "calma", haciaTierra: 0 });
    expect(entradaViento(ESTE, 90, 6)?.entrada).toBe("mar");
  });

  it("sin orientación de la playa, ni dirección o velocidad del viento, no se sabe", () => {
    expect(entradaViento(null, 90, MODERADO)).toBeNull();
    expect(entradaViento(ESTE, null, MODERADO)).toBeNull();
    expect(entradaViento(ESTE, 90, null)).toBeNull();
  });
});
