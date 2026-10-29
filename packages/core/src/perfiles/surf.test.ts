import { describe, expect, it } from "vitest";

import type { Condiciones } from "./comun.ts";
import { notaFamilia } from "./familia.ts";
import { notaSurf } from "./surf.ts";

// Un buen día de levante en La Manga: 1,2 m en la orilla, 8 s y viento de tierra suave
const PERFECTO: Condiciones = {
  olaOrilla: 1.2,
  olaPeriodo: 8,
  vientoVelocidad: 10,
  entradaViento: "tierra",
  temperaturaAire: 20,
  temperaturaAgua: 21,
  nubosidad: 40,
  claridad: 0.3,
  socorrista: null,
  suelo: "arena_fina",
};

const nota = (cambios: Partial<Condiciones>) => notaSurf({ ...PERFECTO, ...cambios })?.nota;

describe("notaSurf", () => {
  it("un buen día de levante con viento de tierra da 100", () => {
    expect(nota({})).toBe(100);
  });

  it("sin ola no hay surf", () => {
    expect(nota({ olaOrilla: 0.3 })).toBe(0);
    expect(nota({ olaOrilla: 0 })).toBe(0);
  });

  it("con poca ola o con demasiada baja, y a partir de 2,8 m se veta", () => {
    // 0,5 m y 2,3 m: a mitad de cada rampa -> 0,5^0,4 = 0,76
    expect(nota({ olaOrilla: 0.5 })).toBe(76);
    expect(nota({ olaOrilla: 2.3 })).toBe(76);
    expect(nota({ olaOrilla: 2.8 })).toBe(0);
  });

  it("el periodo corto es mar de viento: con 4 s se veta", () => {
    expect(nota({ olaPeriodo: 4 })).toBe(0);
    expect(nota({ olaPeriodo: 6 })).toBeLessThan(nota({ olaPeriodo: 8 }) ?? 0);
  });

  it("el viento de tierra peina la ola y el de mar la deshace", () => {
    const tierra = nota({ vientoVelocidad: 20, entradaViento: "tierra" }) ?? 0;
    const lado = nota({ vientoVelocidad: 20, entradaViento: "lado" }) ?? 0;
    const mar = nota({ vientoVelocidad: 20, entradaViento: "mar" }) ?? 0;

    expect(tierra).toBe(100);
    expect(lado).toBeLessThan(tierra);
    expect(mar).toBeLessThan(lado);
    expect(nota({ vientoVelocidad: 25, entradaViento: "mar" })).toBe(0);
  });

  it("un viento de tierra muy fuerte también estorba: cuesta remar", () => {
    expect(nota({ vientoVelocidad: 45, entradaViento: "tierra" })).toBe(0);
  });

  it("en calma, perfecto", () => {
    expect(nota({ vientoVelocidad: 3, entradaViento: "calma" })).toBe(100);
  });

  it("el agua fría resta poco: con neopreno se aguanta", () => {
    expect(nota({ temperaturaAgua: 14 })).toBeGreaterThan(90);
  });

  it("al revés que la familia: el día bueno de surf veta a la familia y al revés", () => {
    const calma = { ...PERFECTO, olaOrilla: 0.1, entradaViento: "mar" as const };

    expect(notaSurf(PERFECTO)?.nota).toBe(100);
    expect(notaFamilia(PERFECTO)?.nota).toBe(0);
    expect(notaSurf(calma)?.nota).toBe(0);
    expect(notaFamilia(calma)?.nota).toBeGreaterThan(0);
  });

  it("el Mar Menor queda fuera aunque sople fuerte: su ola de viento es de periodo corto", () => {
    // 30 km/h con 10 km de laguna en contra: 0,43 m y 2,7 s (oleajeEnOrilla)
    expect(nota({ olaOrilla: 0.43, olaPeriodo: 2.7, entradaViento: "mar" })).toBe(0);
    // Con 50 km/h la ola sale de 4,1 s, pero el viento de mar de 50 km/h la deshace
    expect(nota({ olaOrilla: 1, olaPeriodo: 4.1, vientoVelocidad: 50, entradaViento: "mar" })).toBe(
      0,
    );
  });

  it("sin la ola no hay nota; sin periodo o sin viento se puntúa con el resto", () => {
    expect(notaSurf({ ...PERFECTO, olaOrilla: null })).toBeNull();
    expect(nota({ olaPeriodo: null })).toBe(100);
    expect(nota({ vientoVelocidad: null })).toBe(100);
  });
});
