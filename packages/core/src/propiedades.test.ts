// Tests de propiedades: en lugar de casos concretos, reglas que el motor debe cumplir con
// cualquier entrada. fast-check genera miles de casos al azar (con nulos y extremos) y, si
// alguno rompe una regla, lo reduce al caso más simple que la rompe.
import {
  type Arbitrary,
  array,
  assert,
  boolean,
  constantFrom,
  double,
  integer,
  option,
  property,
  record,
  tuple,
} from "fast-check";
import { describe, expect, it } from "vitest";

import { giro, normalizarRumbo, separacion, vientoLocal } from "./angulos.ts";
import { type Bandera, banderaProbable } from "./bandera.ts";
import { estimarClaridad } from "./claridad.ts";
import { mejorFranja } from "./franja.ts";
import { ortoYOcaso } from "./luz.ts";
import { oleajeEnOrilla } from "./oleaje.ts";
import type { Condiciones, NotaPerfil, Perfil } from "./perfiles/comun.ts";
import { notaFamilia } from "./perfiles/familia.ts";
import { notaSnorkel } from "./perfiles/snorkel.ts";
import { notaSol } from "./perfiles/sol.ts";
import { notaSurf } from "./perfiles/surf.ts";
import { generarRazones } from "./razones.ts";
import { SUELOS } from "./suelo.ts";
import { entradaViento } from "./viento.ts";

const CASOS = { numRuns: 2000 };

const quizas = <T>(arb: Arbitrary<T>) => option(arb, { nil: null });
const real = (min: number, max: number) => double({ min, max, noNaN: true });
const rumbo = () => real(-720, 720);

// Dos valores del intervalo, el primero menor o igual que el segundo
const dosValores = (min: number, max: number) =>
  tuple(real(min, max), real(min, max)).map(([a, b]): [number, number] => [
    Math.min(a, b),
    Math.max(a, b),
  ]);

const condiciones: Arbitrary<Condiciones> = record({
  olaOrilla: quizas(real(0, 6)),
  olaPeriodo: quizas(real(0, 20)),
  vientoVelocidad: quizas(real(0, 150)),
  entradaViento: quizas(constantFrom("mar", "lado", "tierra", "calma")),
  temperaturaAire: quizas(real(-10, 50)),
  temperaturaAgua: quizas(real(5, 35)),
  nubosidad: quizas(real(0, 100)),
  claridad: quizas(real(0, 1)),
  socorrista: quizas(boolean()),
  suelo: quizas(constantFrom(...SUELOS)),
});

const PERFILES: Record<Perfil, (c: Condiciones) => NotaPerfil | null> = {
  familia: notaFamilia,
  snorkel: notaSnorkel,
  sol: notaSol,
  surf: notaSurf,
};
const perfil = constantFrom<Perfil>("familia", "snorkel", "sol", "surf");

describe("notas", () => {
  it("la nota es siempre un entero entre 0 y 100, o null si faltan datos", () => {
    assert(
      property(perfil, condiciones, (p, c) => {
        const resultado = PERFILES[p](c);
        if (resultado === null) return;
        expect(Number.isInteger(resultado.nota)).toBe(true);
        expect(resultado.nota).toBeGreaterThanOrEqual(0);
        expect(resultado.nota).toBeLessThanOrEqual(100);
      }),
      CASOS,
    );
  });

  it("cada factor está entre 0 y 1, o es null si falta su dato", () => {
    assert(
      property(perfil, condiciones, (p, c) => {
        for (const { valor } of PERFILES[p](c)?.factores ?? []) {
          if (valor === null) continue;
          expect(valor).toBeGreaterThanOrEqual(0);
          expect(valor).toBeLessThanOrEqual(1);
        }
      }),
      CASOS,
    );
  });

  it("un factor en 0 deja la nota en 0", () => {
    assert(
      property(perfil, condiciones, (p, c) => {
        const resultado = PERFILES[p](c);
        if (resultado?.factores.some((f) => f.valor === 0)) expect(resultado.nota).toBe(0);
      }),
      CASOS,
    );
  });

  it("los datos imprescindibles de cada plan, si faltan, dejan la nota en null", () => {
    assert(
      property(condiciones, (c) => {
        if (c.olaOrilla === null || c.vientoVelocidad === null) expect(notaFamilia(c)).toBeNull();
        if (c.claridad === null || c.olaOrilla === null) expect(notaSnorkel(c)).toBeNull();
        if (c.nubosidad === null || c.temperaturaAire === null) expect(notaSol(c)).toBeNull();
        if (c.olaOrilla === null) expect(notaSurf(c)).toBeNull();
      }),
      CASOS,
    );
  });
});

// Con todo lo demás igual, cambiar un dato en un sentido nunca mueve la nota en el contrario
describe("las notas se mueven en el sentido que deben", () => {
  it("más ola nunca sube la nota de familia ni la de snorkel", () => {
    assert(
      property(condiciones, dosValores(0, 6), (c, [menos, mas]) => {
        for (const nota of [notaFamilia, notaSnorkel]) {
          const conMenos = nota({ ...c, olaOrilla: menos })?.nota ?? 0;
          const conMas = nota({ ...c, olaOrilla: mas })?.nota ?? 0;
          expect(conMas).toBeLessThanOrEqual(conMenos);
        }
      }),
      CASOS,
    );
  });

  it("más viento nunca sube la nota de familia ni la de tomar el sol", () => {
    assert(
      property(condiciones, dosValores(0, 150), (c, [menos, mas]) => {
        // La calma depende de la velocidad: se fija una entrada que no sea calma
        const base = { ...c, entradaViento: c.entradaViento === "calma" ? "mar" : c.entradaViento };
        for (const nota of [notaFamilia, notaSol]) {
          const conMenos = nota({ ...base, vientoVelocidad: menos })?.nota ?? 0;
          const conMas = nota({ ...base, vientoVelocidad: mas })?.nota ?? 0;
          expect(conMas).toBeLessThanOrEqual(conMenos);
        }
      }),
      CASOS,
    );
  });

  it("agua más clara nunca baja la nota de snorkel", () => {
    assert(
      property(condiciones, dosValores(0, 1), (c, [menos, mas]) => {
        const conMenos = notaSnorkel({ ...c, claridad: menos })?.nota ?? 0;
        const conMas = notaSnorkel({ ...c, claridad: mas })?.nota ?? 0;
        expect(conMas).toBeGreaterThanOrEqual(conMenos);
      }),
      CASOS,
    );
  });

  it("más nubes nunca suben la nota de tomar el sol", () => {
    assert(
      property(condiciones, dosValores(0, 100), (c, [menos, mas]) => {
        const conMenos = notaSol({ ...c, nubosidad: menos })?.nota ?? 0;
        const conMas = notaSol({ ...c, nubosidad: mas })?.nota ?? 0;
        expect(conMas).toBeLessThanOrEqual(conMenos);
      }),
      CASOS,
    );
  });

  it("un periodo más largo nunca baja la nota de surf", () => {
    assert(
      property(condiciones, dosValores(0, 20), (c, [menos, mas]) => {
        const conMenos = notaSurf({ ...c, olaPeriodo: menos })?.nota ?? 0;
        const conMas = notaSurf({ ...c, olaPeriodo: mas })?.nota ?? 0;
        expect(conMas).toBeGreaterThanOrEqual(conMenos);
      }),
      CASOS,
    );
  });
});

describe("razones", () => {
  it("como mucho cuatro, y si algo descarta la playa la nota es 0 y no hay razones a favor", () => {
    assert(
      property(perfil, condiciones, (p, c) => {
        const resultado = PERFILES[p](c);
        if (resultado === null) return;
        const razones = generarRazones(p, resultado, c);
        expect(razones.length).toBeLessThanOrEqual(4);
        expect(razones.every((r) => r.texto.length > 0)).toBe(true);
        if (razones.some((r) => r.tipo === "descarta")) {
          expect(resultado.nota).toBe(0);
          expect(razones.some((r) => r.tipo === "a_favor")).toBe(false);
        }
      }),
      CASOS,
    );
  });
});

describe("ángulos y viento", () => {
  it("normalizarRumbo da siempre [0, 360) y giro (-180, 180]", () => {
    assert(
      property(rumbo(), rumbo(), (a, b) => {
        const n = normalizarRumbo(a);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(360);
        expect(giro(a, b)).toBeGreaterThan(-180);
        expect(giro(a, b)).toBeLessThanOrEqual(180);
        expect(separacion(a, b)).toBeCloseTo(separacion(b, a), 9);
      }),
      CASOS,
    );
  });

  it("todo rumbo tiene viento local, y haciaTierra está entre -1 y 1", () => {
    assert(
      property(rumbo(), rumbo(), real(0, 150), (mira, direccion, velocidad) => {
        expect(vientoLocal(direccion).nombre.length).toBeGreaterThan(0);
        const entrada = entradaViento(normalizarRumbo(mira), direccion, velocidad);
        expect(entrada?.haciaTierra).toBeGreaterThanOrEqual(-1);
        expect(entrada?.haciaTierra).toBeLessThanOrEqual(1);
      }),
      CASOS,
    );
  });
});

describe("oleaje, claridad y bandera", () => {
  const alcances = array(real(0, 50_000), { minLength: 37, maxLength: 37 });

  it("en el Mediterráneo, la ola en la orilla nunca es mayor que mar adentro ni negativa", () => {
    assert(
      property(rumbo(), alcances, real(0, 8), rumbo(), (mira, rayos, altura, direccion) => {
        const ola = oleajeEnOrilla(
          { mira: normalizarRumbo(mira), laguna: false, alcances: rayos },
          {
            olaAltura: altura,
            olaDireccion: normalizarRumbo(direccion),
            olaPeriodo: 6,
            vientoVelocidad: 10,
            vientoDireccion: 0,
          },
        );
        expect(ola?.altura).toBeGreaterThanOrEqual(0);
        // Con margen por el redondeo a centésimas
        expect(ola?.altura).toBeLessThanOrEqual(altura + 0.005);
      }),
      CASOS,
    );
  });

  it("la claridad está entre 0 y 1, y la ola equivalente no pasa de la ola más alta", () => {
    assert(
      property(
        array(quizas(real(0, 5)), { minLength: 1, maxLength: 120 }),
        constantFrom("grueso", "arena", "laguna" as const),
        (alturas, fondo) => {
          const claridad = estimarClaridad(alturas, fondo);
          if (claridad === null) return;
          expect(claridad.claridad).toBeGreaterThanOrEqual(0);
          expect(claridad.claridad).toBeLessThanOrEqual(1);
          const maxima = Math.max(...alturas.map((a) => a ?? 0));
          expect(claridad.olaEquivalente).toBeLessThanOrEqual(maxima + 0.005);
        },
      ),
      CASOS,
    );
  });

  it("más ola nunca baja la bandera", () => {
    const gravedad: Record<Bandera, number> = { verde: 0, amarilla: 1, roja: 2 };
    assert(
      property(
        real(0, 6),
        real(0, 6),
        quizas(real(0, 150)),
        quizas(constantFrom("mar", "lado", "tierra", "calma")),
        (a, b, viento, entrada) => {
          const [menos, mas] = a <= b ? [a, b] : [b, a];
          const conMenos = banderaProbable(menos, viento, entrada)?.bandera ?? "verde";
          const conMas = banderaProbable(mas, viento, entrada)?.bandera ?? "verde";
          expect(gravedad[conMas]).toBeGreaterThanOrEqual(gravedad[conMenos]);
        },
      ),
      CASOS,
    );
  });
});

describe("mejor franja", () => {
  const LUZ = ortoYOcaso("2026-07-15", 37.6, -0.98) ?? { orto: new Date(0), ocaso: new Date(0) };
  const HORA_MS = 3_600_000;
  const INICIO = Date.parse("2026-07-15T00:00:00Z");

  it("si hay franja, son tres horas de día con nota entre 1 y 100", () => {
    assert(
      property(
        array(quizas(integer({ min: 0, max: 100 })), { minLength: 24, maxLength: 24 }),
        (notas) => {
          const franja = mejorFranja(
            notas.map((nota, i) => ({ hora: new Date(INICIO + i * HORA_MS), nota })),
            LUZ,
          );
          if (franja === null) return;
          expect(franja.fin.getTime() - franja.inicio.getTime()).toBe(3 * HORA_MS);
          expect(franja.inicio.getTime()).toBeGreaterThanOrEqual(LUZ.orto.getTime());
          expect(franja.fin.getTime()).toBeLessThanOrEqual(LUZ.ocaso.getTime());
          expect(franja.nota).toBeGreaterThanOrEqual(1);
          expect(franja.nota).toBeLessThanOrEqual(100);
        },
      ),
      CASOS,
    );
  });
});
