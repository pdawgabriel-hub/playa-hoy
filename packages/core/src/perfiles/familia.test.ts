import { describe, expect, it } from "vitest";

import type { Condiciones } from "./comun.ts";
import { notaFamilia } from "./familia.ts";

// Un día perfecto de agosto en el Mar Menor
const PERFECTO: Condiciones = {
  olaOrilla: 0.1,
  olaPeriodo: 6,
  vientoVelocidad: 8,
  entradaViento: "mar",
  temperaturaAire: 28,
  temperaturaAgua: 26,
  nubosidad: 10,
  claridad: 0.9,
  socorrista: true,
  suelo: "arena_fina",
};

const nota = (cambios: Partial<Condiciones>) => notaFamilia({ ...PERFECTO, ...cambios })?.nota;

describe("notaFamilia", () => {
  it("un día perfecto da 100", () => {
    expect(nota({})).toBe(100);
  });

  it("con 0,6 m de ola o más no se recomienda, aunque todo lo demás sea perfecto", () => {
    expect(nota({ olaOrilla: 0.6 })).toBe(0);
    expect(nota({ olaOrilla: 1.2 })).toBe(0);
  });

  it("baja de forma continua al subir la ola", () => {
    const notas = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((olaOrilla) => nota({ olaOrilla }) ?? 0);

    expect(notas).toEqual([100, 100, ...notas.slice(2)]);
    expect(notas.every((n, i) => i < 2 || n < (notas[i - 1] ?? 0))).toBe(true);
    expect(notas.at(-1)).toBe(0);
  });

  it("el mismo viento de 20 km/h resta si es de mar y veta si es de tierra (hinchables)", () => {
    expect(nota({ vientoVelocidad: 20, entradaViento: "mar" })).toBe(92);
    expect(nota({ vientoVelocidad: 20, entradaViento: "tierra" })).toBe(0);
  });

  it("con viento de tierra flojo no pasa nada", () => {
    expect(nota({ vientoVelocidad: 8, entradaViento: "tierra" })).toBe(100);
  });

  it("en calma el viento no resta", () => {
    expect(nota({ vientoVelocidad: 3, entradaViento: "calma" })).toBe(100);
  });

  it("el frío, el agua fría o el agua turbia restan, pero no vetan", () => {
    expect(nota({ temperaturaAire: 12 })).toBeGreaterThan(0);
    expect(nota({ temperaturaAgua: 15 })).toBeGreaterThan(0);
    expect(nota({ claridad: 0 })).toBeGreaterThan(0);
    expect(nota({ temperaturaAgua: 15 })).toBeLessThan(80);
  });

  it("sin socorrista resta un poco, y sin datos de socorrista algo menos", () => {
    const sin = nota({ socorrista: false }) ?? 0;
    const sinDatos = nota({ socorrista: null }) ?? 0;

    expect(sin).toBeLessThan(sinDatos);
    expect(sinDatos).toBeLessThan(100);
    expect(sin).toBeGreaterThan(95);
  });

  it("un caso intermedio: 0,4 m de ola y 20 km/h de mar", () => {
    // 0,5^0,35 · 0,65^0,2 = 0,72
    expect(nota({ olaOrilla: 0.4, vientoVelocidad: 20 })).toBe(72);
  });

  it("sin la ola o el viento no hay nota", () => {
    expect(notaFamilia({ ...PERFECTO, olaOrilla: null })).toBeNull();
    expect(notaFamilia({ ...PERFECTO, vientoVelocidad: null })).toBeNull();
  });

  it("sin la temperatura del agua, se puntúa con el resto", () => {
    expect(nota({ temperaturaAgua: null })).toBe(100);
  });

  it("devuelve cada factor para poder explicar la nota", () => {
    const factores = notaFamilia({ ...PERFECTO, olaOrilla: 0.4 })?.factores ?? [];

    expect(factores.map((f) => f.nombre)).toEqual([
      "ola",
      "viento",
      "temperatura_aire",
      "temperatura_agua",
      "claridad",
      "socorrista",
    ]);
    expect(factores[0]?.valor).toBe(0.5);
  });
});
