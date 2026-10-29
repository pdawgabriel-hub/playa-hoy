// Escenarios típicos de la costa de Murcia sobre la geografía real de 8 playas. Comprueban
// lo que se sabe de la costa, no cifras exactas: "con levante, al sur", "con mar de fondo de
// levante y poniente, surf en La Manga"...
import { describe, expect, it } from "vitest";

import {
  type HoraEvaluada,
  type HoraPrevision,
  type PlayaEvaluada,
  evaluarPlaya,
} from "./evaluar.ts";
import referencia from "./pruebas/playas-referencia.json" with { type: "json" };
import { esSuelo } from "./suelo.ts";

const HORA_MS = 3_600_000;
const HISTORIA = 96;

type Tiempo = Omit<HoraPrevision, "hora">;

const PLAYAS = new Map<string, PlayaEvaluada>(
  referencia.playas.map((p) => [
    p.nombre,
    {
      mira: p.mira,
      laguna: p.laguna,
      alcances: p.alcances,
      suelo: esSuelo(p.suelo) ? p.suelo : null,
      socorrista: p.socorrista,
    },
  ]),
);

// La hora evaluada de una playa con un tiempo sostenido durante las 96 horas previas
function evaluar(nombre: string, tiempo: Tiempo): HoraEvaluada {
  const playa = PLAYAS.get(nombre);
  if (!playa) throw new Error(`No está en el fixture: ${nombre}`);
  const horas = Array.from({ length: HISTORIA + 1 }, (_, i) => ({
    hora: new Date(i * HORA_MS),
    ...tiempo,
  }));
  const [hora] = evaluarPlaya(playa, horas, new Date(HISTORIA * HORA_MS));
  if (!hora) throw new Error(`Sin evaluación para ${nombre}`);
  return hora;
}

const nota = (h: HoraEvaluada, perfil: keyof HoraEvaluada["notas"]) => h.notas[perfil]?.nota ?? -1;
const todas = [...PLAYAS.keys()];

const LEVANTE_FUERTE: Tiempo = {
  olaAltura: 1.8,
  olaDireccion: 90,
  olaPeriodo: 7,
  vientoVelocidad: 30,
  vientoDireccion: 90,
  temperaturaAire: 22,
  temperaturaAgua: 22,
  nubosidad: 70,
};

const MAR_DE_FONDO_CON_PONIENTE: Tiempo = {
  olaAltura: 1.4,
  olaDireccion: 85,
  olaPeriodo: 8,
  vientoVelocidad: 10,
  vientoDireccion: 270,
  temperaturaAire: 22,
  temperaturaAgua: 22,
  nubosidad: 20,
};

const PONIENTE: Tiempo = {
  olaAltura: 0.3,
  olaDireccion: 250,
  olaPeriodo: 4,
  vientoVelocidad: 30,
  vientoDireccion: 270,
  temperaturaAire: 33,
  temperaturaAgua: 25,
  nubosidad: 0,
};

const CALMA_DE_VERANO: Tiempo = {
  olaAltura: 0.2,
  olaDireccion: 100,
  olaPeriodo: 5,
  vientoVelocidad: 5,
  vientoDireccion: 120,
  temperaturaAire: 29,
  temperaturaAgua: 27,
  nubosidad: 0,
};

// La brisa de mar de las tardes de verano, del sudeste: mar de viento de periodo corto (con
// 18 km/h de viento, unos 3-4 s)
const BRISA: Tiempo = {
  ...CALMA_DE_VERANO,
  olaAltura: 0.4,
  olaDireccion: 120,
  olaPeriodo: 4,
  vientoVelocidad: 18,
};

describe("levante fuerte", () => {
  it("La Manga hacia el Mediterráneo no es para familias y tiene bandera amarilla", () => {
    const galua = evaluar("Galúa", LEVANTE_FUERTE);

    expect(nota(galua, "familia")).toBe(0);
    expect(galua.bandera?.bandera).toBe("amarilla");
    expect(galua.claridad?.estado).toBe("turbia");
  });

  it("con levante, al sur: Mazarrón, Águilas y Cartagena están resguardadas", () => {
    for (const resguardada of ["Bolnuevo", "Levante", "El Portús"]) {
      expect(nota(evaluar(resguardada, LEVANTE_FUERTE), "familia")).toBeGreaterThan(50);
    }
  });

  it("en la orilla del Mar Menor de La Manga el levante es de tierra: arrastra los hinchables", () => {
    const galan = evaluar("El Galán", LEVANTE_FUERTE);

    expect(galan.condiciones.entradaViento).toBe("tierra");
    expect(nota(galan, "familia")).toBe(0);
    expect(galan.notas.familia?.razones[0]?.texto).toMatch(/hinchables/);
  });

  it("con 30 km/h no es día de tumbarse al sol en ninguna playa", () => {
    expect(todas.map((p) => nota(evaluar(p, LEVANTE_FUERTE), "sol"))).toEqual(todas.map(() => 0));
  });
});

describe("mar de fondo de levante con poniente suave", () => {
  it("es día de surf en La Manga: la ola entra y el poniente la peina", () => {
    const galua = evaluar("Galúa", MAR_DE_FONDO_CON_PONIENTE);

    expect(nota(galua, "surf")).toBeGreaterThanOrEqual(90);
    expect(galua.condiciones.entradaViento).toBe("tierra");
    expect(nota(galua, "familia")).toBe(0);
  });

  it("en el resto, abrigadas del levante o en la laguna, no hay ola para surfear", () => {
    for (const playa of todas.filter((p) => p !== "Galúa")) {
      expect(nota(evaluar(playa, MAR_DE_FONDO_CON_PONIENTE), "surf")).toBe(0);
    }
  });
});

describe("poniente", () => {
  it("en La Manga hacia el Mediterráneo es de tierra: bandera amarilla y no para familias", () => {
    const galua = evaluar("Galúa", PONIENTE);

    expect(galua.bandera).toEqual({ bandera: "amarilla", motivos: ["viento_tierra"] });
    expect(nota(galua, "familia")).toBe(0);
  });

  it("en el Mar Menor llega desde la laguna y levanta picado en la orilla de La Manga", () => {
    const galan = evaluar("El Galán", PONIENTE);

    expect(galan.condiciones.entradaViento).toBe("mar");
    expect(galan.condiciones.olaOrilla).toBeGreaterThan(0.2);
  });
});

describe("calma de verano", () => {
  it("es buen día para familias y para tomar el sol en todas las playas", () => {
    for (const playa of todas) {
      const h = evaluar(playa, CALMA_DE_VERANO);
      expect(nota(h, "familia")).toBeGreaterThanOrEqual(95);
      expect(nota(h, "sol")).toBe(100);
    }
  });

  it("no hay surf en ninguna", () => {
    expect(todas.map((p) => nota(evaluar(p, CALMA_DE_VERANO), "surf"))).toEqual(todas.map(() => 0));
  });

  it("para snorkel, mejor las calas de fondo mixto que las playas de arena fina", () => {
    const portus = nota(evaluar("El Portús", CALMA_DE_VERANO), "snorkel");
    const azohia = nota(evaluar("La Azohía-El Cuartel", CALMA_DE_VERANO), "snorkel");
    const galua = nota(evaluar("Galúa", CALMA_DE_VERANO), "snorkel");

    expect(portus).toBeGreaterThan(galua);
    expect(azohia).toBeGreaterThan(galua);
  });
});

describe("brisa de tarde", () => {
  it("baja algo las notas de familia respecto a la calma, sin bandera roja ni vetos de seguridad", () => {
    for (const playa of todas) {
      const brisa = evaluar(playa, BRISA);
      expect(nota(brisa, "familia")).toBeGreaterThanOrEqual(60);
      expect(nota(brisa, "familia")).toBeLessThanOrEqual(
        nota(evaluar(playa, CALMA_DE_VERANO), "familia"),
      );
      expect(brisa.bandera?.bandera).not.toBe("roja");
    }
  });

  it("tampoco hay surf: la brisa es mar de viento", () => {
    expect(todas.map((p) => nota(evaluar(p, BRISA), "surf"))).toEqual(todas.map(() => 0));
  });
});
