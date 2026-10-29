import { describe, expect, it } from "vitest";

import type { Condiciones } from "./comun.ts";
import { notaFamilia } from "./familia.ts";
import { notaSnorkel } from "./snorkel.ts";

// Una cala de roca con el mar plano, el agua clara y sol
const PERFECTO: Condiciones = {
  olaOrilla: 0.05,
  olaPeriodo: 6,
  vientoVelocidad: 8,
  entradaViento: "mar",
  temperaturaAire: 28,
  temperaturaAgua: 25,
  nubosidad: 10,
  claridad: 0.95,
  socorrista: null,
  suelo: "roca",
};

const nota = (cambios: Partial<Condiciones>) => notaSnorkel({ ...PERFECTO, ...cambios })?.nota;

describe("notaSnorkel", () => {
  it("una cala de roca con el mar plano y el agua clara da 100", () => {
    expect(nota({})).toBe(100);
  });

  it("con el agua turbia no se recomienda, aunque todo lo demás sea perfecto", () => {
    expect(nota({ claridad: 0.4 })).toBe(0);
    expect(nota({ claridad: 0.1 })).toBe(0);
  });

  it("con agua buena, pero no cristalina, baja sin vetar", () => {
    // Claridad 0,6: rampa entre 0,85 y 0,4 -> 0,44; 0,44^0,35 = 0,75
    expect(nota({ claridad: 0.6 })).toBe(75);
  });

  it("con 0,5 m de ola o más no se recomienda: la resaca empuja contra las rocas", () => {
    expect(nota({ olaOrilla: 0.5 })).toBe(0);
  });

  it("la misma playa con fondo de arena puntúa menos que con roca, pero no se veta", () => {
    const arena = nota({ suelo: "arena_fina" }) ?? 0;

    expect(arena).toBeLessThan(100);
    expect(arena).toBeGreaterThan(80);
    expect(nota({ suelo: "arena_y_grava" })).toBeGreaterThan(arena);
  });

  it("sin datos del suelo se queda entre la arena y la roca", () => {
    const sinDatos = nota({ suelo: null }) ?? 0;

    expect(sinDatos).toBeGreaterThan(nota({ suelo: "arena" }) ?? 0);
    expect(sinDatos).toBeLessThan(100);
  });

  it("el viento de tierra veta antes que el de mar", () => {
    expect(nota({ vientoVelocidad: 25, entradaViento: "mar" })).toBeGreaterThan(0);
    expect(nota({ vientoVelocidad: 25, entradaViento: "tierra" })).toBe(0);
  });

  it("con el cielo cubierto se ve peor, pero resta poco", () => {
    const cubierto = nota({ nubosidad: 100 }) ?? 0;

    expect(cubierto).toBeLessThan(100);
    expect(cubierto).toBeGreaterThan(95);
  });

  it("sin la claridad o la ola no hay nota; sin el viento se puntúa con el resto", () => {
    expect(notaSnorkel({ ...PERFECTO, claridad: null })).toBeNull();
    expect(notaSnorkel({ ...PERFECTO, olaOrilla: null })).toBeNull();
    expect(nota({ vientoVelocidad: null })).toBe(100);
  });

  it("una misma hora puede ser buena para la familia y mala para el snorkel", () => {
    // Playa de arena con el mar plano pero el agua aún turbia tras un temporal
    const condiciones = { ...PERFECTO, suelo: "arena_fina" as const, claridad: 0.3 };

    expect(notaSnorkel(condiciones)?.nota).toBe(0);
    expect(notaFamilia(condiciones)?.nota).toBeGreaterThan(80);
  });
});
