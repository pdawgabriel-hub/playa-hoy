import { describe, expect, it } from "vitest";

import { type Fondo, SEMIVIDA_H, estimarClaridad, fondoDePlaya } from "./claridad.ts";

const horas = (n: number, altura: number | null) => Array.from({ length: n }, () => altura);

// Un temporal de 1 m durante un día y después `calma` horas con el mar casi plano (0,1 m)
const trasTemporal = (calma: number) => [...horas(24, 1), ...horas(calma + 1, 0.1)];

// Horas de calma hasta que el agua vuelve a estar cristalina
const horasHastaCristalina = (fondo: Fondo) => {
  let calma = 0;
  while (estimarClaridad(trasTemporal(calma), fondo)?.estado !== "cristalina") calma++;
  return calma;
};

describe("estimarClaridad", () => {
  it("con el mar en calma de forma continuada, el agua está cristalina", () => {
    expect(estimarClaridad(horas(49, 0.1), "arena")).toEqual({
      estado: "cristalina",
      claridad: 0.9,
      olaEquivalente: 0.1,
    });
  });

  it("con oleaje sostenido, la ola equivalente es esa misma ola", () => {
    expect(estimarClaridad(horas(49, 0.3), "arena")).toMatchObject({
      estado: "buena",
      olaEquivalente: 0.3,
    });
    expect(estimarClaridad(horas(49, 1), "arena")).toEqual({
      estado: "turbia",
      claridad: 0,
      olaEquivalente: 1,
    });
  });

  it("los cortes están en 0,2 m (ya buena) y 0,5 m (ya turbia)", () => {
    expect(estimarClaridad([0.19], "arena")?.estado).toBe("cristalina");
    expect(estimarClaridad([0.2], "arena")?.estado).toBe("buena");
    expect(estimarClaridad([0.49], "arena")?.estado).toBe("buena");
    expect(estimarClaridad([0.5], "arena")?.estado).toBe("turbia");
  });

  it("después de un temporal, el agua sigue turbia un tiempo con el mar ya en calma", () => {
    // Sobre arena: turbia medio día después y buena al día siguiente
    expect(estimarClaridad(trasTemporal(0), "arena")?.estado).toBe("turbia");
    expect(estimarClaridad(trasTemporal(12), "arena")?.estado).toBe("turbia");
    expect(estimarClaridad(trasTemporal(24), "arena")?.estado).toBe("buena");
  });

  it("aclara antes sobre grava que sobre arena, y la laguna es la que más tarda", () => {
    const grueso = horasHastaCristalina("grueso");
    const arena = horasHastaCristalina("arena");
    const laguna = horasHastaCristalina("laguna");

    expect(grueso).toBeLessThan(arena);
    expect(arena).toBeLessThan(laguna);
  });

  it("se va aclarando hora a hora, sin saltos hacia atrás", () => {
    const valores = Array.from(
      { length: 48 },
      (_, calma) => estimarClaridad(trasTemporal(calma), "arena")?.claridad ?? 0,
    );

    expect(valores.every((v, i) => i === 0 || v >= (valores[i - 1] ?? 0))).toBe(true);
  });

  it("un temporal de hace más de 4 semividas ya no cuenta", () => {
    for (const fondo of ["grueso", "arena", "laguna"] as const) {
      const memoria = 4 * SEMIVIDA_H[fondo];
      const antiguo = [...horas(24, 2), ...horas(memoria + 1, 0.1)];

      expect(estimarClaridad(antiguo, fondo)).toEqual(estimarClaridad(horas(1, 0.1), fondo));
    }
  });

  it("el Mar Menor tarda en aclarar más de 48 horas, no lo corta la memoria", () => {
    expect(horasHastaCristalina("laguna")).toBeGreaterThan(48);
  });

  it("las horas previas sin dato no cuentan", () => {
    expect(estimarClaridad([null, null, 0.1], "arena")).toEqual(estimarClaridad([0.1], "arena"));
  });

  it("sin la ola de la hora actual, no se sabe", () => {
    expect(estimarClaridad([0.1, 0.1, null], "arena")).toBeNull();
    expect(estimarClaridad([], "arena")).toBeNull();
  });
});

describe("fondoDePlaya", () => {
  it("el Mar Menor tiene su propio fondo, sea cual sea la arena de la playa", () => {
    expect(fondoDePlaya("arena_fina", true)).toBe("laguna");
  });

  it("grava, bolos y roca aclaran rápido; la arena, también mezclada, no", () => {
    expect(fondoDePlaya("grava", false)).toBe("grueso");
    expect(fondoDePlaya("bolos", false)).toBe("grueso");
    expect(fondoDePlaya("roca", false)).toBe("grueso");
    expect(fondoDePlaya("arena_y_grava", false)).toBe("arena");
    expect(fondoDePlaya("arena_fina", false)).toBe("arena");
  });

  it("sin datos del suelo se supone arena", () => {
    expect(fondoDePlaya(null, false)).toBe("arena");
  });
});
