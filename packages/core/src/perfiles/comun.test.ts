import { describe, expect, it } from "vitest";

import { combinar, conSuelo, meseta, rampa } from "./comun.ts";

describe("rampa", () => {
  it("baja de 1 a 0 entre el valor bueno y el malo, y se queda fija fuera", () => {
    expect(rampa(0.1, 0.2, 0.6)).toBe(1);
    expect(rampa(0.4, 0.2, 0.6)).toBeCloseTo(0.5);
    expect(rampa(1, 0.2, 0.6)).toBe(0);
  });

  it("sirve también hacia arriba, con el bueno mayor que el malo", () => {
    expect(rampa(25, 24, 18)).toBe(1);
    expect(rampa(21, 24, 18)).toBeCloseTo(0.5);
    expect(rampa(15, 24, 18)).toBe(0);
  });
});

describe("meseta", () => {
  it("es 1 en el tramo bueno y baja hacia los dos lados", () => {
    expect(meseta(27, 16, 24, 30, 38)).toBe(1);
    expect(meseta(20, 16, 24, 30, 38)).toBeCloseTo(0.5);
    expect(meseta(34, 16, 24, 30, 38)).toBeCloseTo(0.5);
    expect(meseta(40, 16, 24, 30, 38)).toBe(0);
  });
});

describe("conSuelo", () => {
  it("lleva el 0 al suelo y deja el 1 como está", () => {
    expect(conSuelo(0, 0.2)).toBe(0.2);
    expect(conSuelo(1, 0.2)).toBe(1);
    expect(conSuelo(0.5, 0.2)).toBeCloseTo(0.6);
  });
});

describe("combinar", () => {
  it("todo perfecto da 100", () => {
    expect(
      combinar([
        { nombre: "a", valor: 1, peso: 0.6 },
        { nombre: "b", valor: 1, peso: 0.4 },
      ]).nota,
    ).toBe(100);
  });

  it("es la media geométrica ponderada", () => {
    // 0,5^0,5 · 1^0,5 = 0,71
    const { nota } = combinar([
      { nombre: "a", valor: 0.5, peso: 0.5 },
      { nombre: "b", valor: 1, peso: 0.5 },
    ]);

    expect(nota).toBe(71);
  });

  it("un factor en 0 deja la nota en 0, pese poco o mucho", () => {
    const { nota } = combinar([
      { nombre: "a", valor: 0, peso: 0.05 },
      { nombre: "b", valor: 1, peso: 0.95 },
    ]);

    expect(nota).toBe(0);
  });

  it("un factor sin dato no cuenta: su peso se reparte entre los demás", () => {
    const con = combinar([
      { nombre: "a", valor: 0.5, peso: 0.5 },
      { nombre: "b", valor: null, peso: 0.5 },
    ]);

    expect(con.nota).toBe(50);
    expect(con.factores[1]).toEqual({ nombre: "b", valor: null, peso: 0.5 });
  });

  it("devuelve cada factor redondeado a centésimas", () => {
    const { factores } = combinar([{ nombre: "a", valor: 0.666_666, peso: 1 }]);

    expect(factores[0]?.valor).toBe(0.67);
  });
});
