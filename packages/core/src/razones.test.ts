import { describe, expect, it } from "vitest";

import type { Condiciones } from "./perfiles/comun.ts";
import { notaFamilia } from "./perfiles/familia.ts";
import { notaSnorkel } from "./perfiles/snorkel.ts";
import { notaSol } from "./perfiles/sol.ts";
import { notaSurf } from "./perfiles/surf.ts";
import { MAX_RAZONES, generarRazones } from "./razones.ts";

const BASE: Condiciones = {
  olaOrilla: 0.1,
  olaPeriodo: 6,
  vientoVelocidad: 8,
  entradaViento: "mar",
  temperaturaAire: 27,
  temperaturaAgua: 25,
  nubosidad: 10,
  claridad: 0.95,
  socorrista: true,
  suelo: "arena_fina",
};

const razones = {
  familia: (cambios: Partial<Condiciones>) => {
    const c = { ...BASE, ...cambios };
    const nota = notaFamilia(c);
    return nota ? generarRazones("familia", nota, c) : [];
  },
  snorkel: (cambios: Partial<Condiciones>) => {
    const c = { ...BASE, ...cambios };
    const nota = notaSnorkel(c);
    return nota ? generarRazones("snorkel", nota, c) : [];
  },
  sol: (cambios: Partial<Condiciones>) => {
    const c = { ...BASE, ...cambios };
    const nota = notaSol(c);
    return nota ? generarRazones("sol", nota, c) : [];
  },
  surf: (cambios: Partial<Condiciones>) => {
    const c = { ...BASE, ...cambios };
    const nota = notaSurf(c);
    return nota ? generarRazones("surf", nota, c) : [];
  },
};

const textos = (lista: { texto: string }[]) => lista.map((r) => r.texto);

describe("generarRazones", () => {
  it("un día perfecto para la familia da sus razones a favor, con la cifra", () => {
    const lista = razones.familia({});

    expect(lista.every((r) => r.tipo === "a_favor")).toBe(true);
    expect(textos(lista)).toEqual([
      "Poca ola en la orilla (0,1 m)",
      "Viento suave (8 km/h)",
      "Temperatura agradable (27 °C)",
      "Agua templada (25 °C)",
    ]);
  });

  it("como mucho da cuatro razones", () => {
    expect(razones.familia({})).toHaveLength(MAX_RAZONES);
  });

  it("lo que descarta la playa va primero", () => {
    const [primera] = razones.familia({ olaOrilla: 0.8, temperaturaAgua: 19 });

    expect(primera).toEqual({
      tipo: "descarta",
      factor: "ola",
      texto: "Demasiada ola para niños (0,8 m en la orilla)",
    });
  });

  it("lo que más resta va antes que lo que menos", () => {
    // Agua fría (factor 0,33, peso 0,15) resta más que viento de 22 km/h (0,57, peso 0,2)
    const lista = razones.familia({ temperaturaAgua: 19, vientoVelocidad: 22 });
    const enContra = lista.filter((r) => r.tipo === "en_contra").map((r) => r.factor);

    expect(enContra).toEqual(["temperatura_agua", "viento"]);
  });

  it("una nota alta empieza por lo que más suma, pero las advertencias caben siempre", () => {
    // Nota 76: primero la ola (a favor), después lo que resta
    const lista = razones.familia({ temperaturaAgua: 19, vientoVelocidad: 22 });

    expect(lista.map((r) => r.tipo)).toEqual(["a_favor", "en_contra", "en_contra", "a_favor"]);
    expect(lista[0]?.factor).toBe("ola");
  });

  it("una nota baja empieza por lo que resta", () => {
    // Ola de 0,45 m y agua a 19 °C: nota por debajo de 70
    const c = { ...BASE, olaOrilla: 0.45, temperaturaAgua: 19 };
    const nota = notaFamilia(c);
    const lista = nota ? generarRazones("familia", nota, c) : [];

    expect(nota?.nota).toBeLessThan(70);
    expect(lista[0]?.tipo).toBe("en_contra");
  });

  it("en familia, el viento de tierra avisa de los hinchables", () => {
    expect(textos(razones.familia({ vientoVelocidad: 15, entradaViento: "tierra" }))).toContain(
      "Viento de tierra (15 km/h): cuidado con los hinchables",
    );
    expect(textos(razones.familia({ vientoVelocidad: 22, entradaViento: "tierra" }))[0]).toBe(
      "Viento de tierra (22 km/h): arrastra los hinchables mar adentro",
    );
  });

  it("en snorkel, el agua turbia descarta y el fondo de roca suma", () => {
    expect(razones.snorkel({ claridad: 0.3 })[0]?.texto).toBe("Agua turbia: no se verá el fondo");
    expect(textos(razones.snorkel({ suelo: "roca" }))).toContain("Fondo de roca: más vida marina");
    expect(textos(razones.snorkel({ suelo: "arena" }))).toContain(
      "Fondo de arena: poca vida marina",
    );
  });

  it("para tomar el sol distingue el calor del frío", () => {
    expect(razones.sol({ temperaturaAire: 39 })[0]?.texto).toBe(
      "Demasiado calor: riesgo de golpe de calor (39 °C)",
    );
    expect(razones.sol({ temperaturaAire: 13 })[0]?.texto).toBe(
      "Demasiado frío para tumbarse (13 °C)",
    );
    expect(textos(razones.sol({ temperaturaAire: 35 }))).toContain("Calor (35 °C)");
  });

  it("para tomar el sol, la poca ola no se menciona", () => {
    expect(razones.sol({}).some((r) => r.factor === "ola")).toBe(false);
  });

  it("en surf, la poca ola es en contra y el viento de tierra a favor", () => {
    const buenDia = razones.surf({ olaOrilla: 1.2, olaPeriodo: 9, entradaViento: "tierra" });

    expect(textos(buenDia)).toEqual([
      "Buena ola (1,2 m en la orilla)",
      "Periodo largo (9 s): ola ordenada",
      "Viento de tierra (8 km/h): peina la ola",
      "Agua templada (25 °C)",
    ]);
    expect(razones.surf({ olaOrilla: 0.2 })[0]?.texto).toBe("Sin ola para surfear");
    expect(razones.surf({ olaOrilla: 3 })[0]?.texto).toBe(
      "Demasiada ola: peligroso (3 m en la orilla)",
    );
    expect(textos(razones.surf({ olaOrilla: 1, vientoVelocidad: 15 }))).toContain(
      "Viento de mar (15 km/h): deshace la ola",
    );
  });

  it("sin socorrista lo dice; sin datos de socorrista no dice nada", () => {
    expect(textos(razones.familia({ socorrista: false, temperaturaAgua: 20 }))).toContain(
      "Sin socorrista",
    );
    expect(razones.familia({ socorrista: null }).some((r) => r.factor === "socorrista")).toBe(
      false,
    );
  });

  it("un factor sin dato no da razón", () => {
    expect(
      razones.familia({ temperaturaAgua: null }).some((r) => r.factor === "temperatura_agua"),
    ).toBe(false);
  });

  it("con el mar casi plano dice mar en calma, no 0 m", () => {
    expect(textos(razones.familia({ olaOrilla: 0.02 }))[0]).toBe("Mar en calma");
  });

  it("si algo descarta la playa, no da razones a favor", () => {
    const lista = razones.surf({ olaOrilla: 0.1, entradaViento: "tierra" });

    // Descarta por la ola y resta por el periodo de 6 s; el viento de tierra no se menciona
    expect(lista.map((r) => r.tipo)).toEqual(["descarta", "en_contra"]);
    expect(lista[0]?.texto).toBe("Sin ola para surfear");
  });

  it("los decimales van con coma", () => {
    expect(textos(razones.familia({ olaOrilla: 0.45 }))).toContain("Ola de 0,5 m en la orilla");
  });
});
