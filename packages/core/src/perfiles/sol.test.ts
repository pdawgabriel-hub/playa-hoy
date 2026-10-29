import { describe, expect, it } from "vitest";

import type { Condiciones } from "./comun.ts";
import { notaFamilia } from "./familia.ts";
import { notaSol } from "./sol.ts";

// Una mañana de junio despejada y sin viento
const PERFECTO: Condiciones = {
  olaOrilla: 0.2,
  olaPeriodo: 6,
  vientoVelocidad: 6,
  entradaViento: "mar",
  temperaturaAire: 27,
  temperaturaAgua: 23,
  nubosidad: 5,
  claridad: 0.9,
  socorrista: null,
  suelo: "arena_fina",
};

const nota = (cambios: Partial<Condiciones>) => notaSol({ ...PERFECTO, ...cambios })?.nota;

describe("notaSol", () => {
  it("un día despejado, templado y sin viento da 100", () => {
    expect(nota({})).toBe(100);
  });

  it("con el cielo cubierto no se recomienda", () => {
    expect(nota({ nubosidad: 90 })).toBe(0);
    expect(nota({ nubosidad: 100 })).toBe(0);
  });

  it("con algunas nubes baja sin vetar", () => {
    // 55 %: rampa entre 20 y 90 -> 0,5; 0,5^0,35 = 0,78
    expect(nota({ nubosidad: 55 })).toBe(78);
  });

  it("con 38 °C o más no se recomienda: riesgo de golpe de calor", () => {
    expect(nota({ temperaturaAire: 38 })).toBe(0);
    expect(nota({ temperaturaAire: 41 })).toBe(0);
  });

  it("el calor va restando antes de vetar", () => {
    const notas = [30, 34, 37].map((temperaturaAire) => nota({ temperaturaAire }) ?? 0);

    expect(notas).toEqual([100, 81, 54]);
  });

  it("con frío tampoco: 14 °C o menos veta", () => {
    expect(nota({ temperaturaAire: 14 })).toBe(0);
    expect(nota({ temperaturaAire: 18 })).toBeGreaterThan(0);
  });

  it("con 30 km/h de viento no se recomienda, venga de donde venga", () => {
    expect(nota({ vientoVelocidad: 30, entradaViento: "mar" })).toBe(0);
    expect(nota({ vientoVelocidad: 30, entradaViento: "tierra" })).toBe(0);
    expect(nota({ vientoVelocidad: 20, entradaViento: "tierra" })).toBe(
      nota({ vientoVelocidad: 20, entradaViento: "mar" }),
    );
  });

  it("la ola apenas cuenta: con 1,5 m sigue siendo un buen día de sol", () => {
    expect(nota({ olaOrilla: 1.5 })).toBeGreaterThan(95);
  });

  it("un día de sol con mar movido es bueno para tomar el sol y malo para la familia", () => {
    const condiciones = { ...PERFECTO, olaOrilla: 1 };

    expect(notaSol(condiciones)?.nota).toBeGreaterThan(95);
    expect(notaFamilia(condiciones)?.nota).toBe(0);
  });

  it("sin nubosidad o temperatura del aire no hay nota; sin viento se puntúa con el resto", () => {
    expect(notaSol({ ...PERFECTO, nubosidad: null })).toBeNull();
    expect(notaSol({ ...PERFECTO, temperaturaAire: null })).toBeNull();
    expect(nota({ vientoVelocidad: null })).toBe(100);
  });
});
