import { describe, expect, it } from "vitest";

import { type HoraOleaje, type PlayaOleaje, alcanceEn, oleajeEnOrilla } from "./oleaje.ts";

const ABIERTO = 50_000;
// 37 rayos de mira - 90° a mira + 90°: todo mar abierto
const abierta = () => Array.from({ length: 37 }, () => ABIERTO);
// Un cabo tapa los rayos de la izquierda (de mira - 90° a mira - 30°) a 3 km
const conCaboALaIzquierda = () => abierta().map((a, i) => (i <= 12 ? 3000 : a));

const ESTE = 90;
const playaAbierta: PlayaOleaje = { mira: ESTE, laguna: false, alcances: abierta() };

const hora = (cambios: Partial<HoraOleaje>): HoraOleaje => ({
  olaAltura: 1,
  olaDireccion: ESTE,
  olaPeriodo: 7,
  vientoVelocidad: 20,
  vientoDireccion: ESTE,
  ...cambios,
});

const periodoConViento = (playa: PlayaOleaje, kmh: number) =>
  oleajeEnOrilla(playa, hora({ vientoVelocidad: kmh }))?.periodo ?? 0;

const alturaConViento = (playa: PlayaOleaje, kmh: number) =>
  oleajeEnOrilla(playa, hora({ vientoVelocidad: kmh }))?.altura ?? 0;

describe("alcanceEn", () => {
  const alcances = Array.from({ length: 37 }, (_, i) => i * 1000);

  it("da el rayo de cada rumbo, de mira - 90° a mira + 90°", () => {
    expect(alcanceEn(ESTE, alcances, 0)).toBe(0);
    expect(alcanceEn(ESTE, alcances, ESTE)).toBe(18_000);
    expect(alcanceEn(ESTE, alcances, 180)).toBe(36_000);
  });

  it("interpola entre los dos rayos más cercanos", () => {
    expect(alcanceEn(ESTE, alcances, 92.5)).toBe(18_500);
  });

  it("acierta al cruzar el norte", () => {
    // Mira al norte: el rayo de 350° es el de mira - 10°
    expect(alcanceEn(0, alcances, 350)).toBe(16_000);
  });

  it("un rumbo detrás de la playa no tiene alcance", () => {
    expect(alcanceEn(ESTE, alcances, 270)).toBeNull();
  });
});

describe("oleajeEnOrilla en el Mediterráneo", () => {
  it("una ola de frente con mar abierto llega entera", () => {
    expect(oleajeEnOrilla(playaAbierta, hora({}))).toEqual({
      altura: 1,
      periodo: 7,
      origen: "mar_adentro",
    });
  });

  it("una ola oblicua llega con la raíz del coseno del ángulo", () => {
    // A 60°: √cos 60° = √0,5 = 0,71
    expect(oleajeEnOrilla(playaAbierta, hora({ olaDireccion: ESTE + 60 }))?.altura).toBe(0.71);
  });

  it("una ola que viene de detrás de la playa no llega", () => {
    expect(oleajeEnOrilla(playaAbierta, hora({ olaDireccion: 270 }))?.altura).toBe(0);
    expect(oleajeEnOrilla(playaAbierta, hora({ olaDireccion: 0 }))?.altura).toBe(0);
  });

  it("un cabo frena la ola que entra por su lado y deja pasar la del otro", () => {
    const playa = { ...playaAbierta, alcances: conCaboALaIzquierda() };
    // Por la izquierda, a 45°: 3 km de 30 km de mar libre, √cos 45° = 0,84 -> 0,08 m
    expect(oleajeEnOrilla(playa, hora({ olaDireccion: ESTE - 45 }))?.altura).toBe(0.08);
    // Por la derecha, a 45°: mar abierto -> 0,84 m
    expect(oleajeEnOrilla(playa, hora({ olaDireccion: ESTE + 45 }))?.altura).toBe(0.84);
  });

  it("no depende del viento: eso ya está en la ola mar adentro", () => {
    expect(oleajeEnOrilla(playaAbierta, hora({ vientoVelocidad: 60 }))?.altura).toBe(1);
  });

  it("sin datos del modelo marino, no se sabe", () => {
    expect(oleajeEnOrilla(playaAbierta, hora({ olaAltura: null }))).toBeNull();
    expect(oleajeEnOrilla(playaAbierta, hora({ olaDireccion: null }))).toBeNull();
  });
});

describe("oleajeEnOrilla en el Mar Menor", () => {
  // 10 km de laguna delante en todas las direcciones
  const laguna: PlayaOleaje = {
    mira: ESTE,
    laguna: true,
    alcances: Array.from({ length: 37 }, () => 10_000),
  };

  it("con viento de la laguna, la ola sale del viento y del alcance", () => {
    // 30 km/h = 8,33 m/s; 0,0016 · 8,33 · √(10.000 / 9,81) = 0,43 m
    // y un periodo de 0,2857 · (8,33 / 9,81) · ∛(9,81 · 10.000 / 8,33²) = 2,7 s
    expect(oleajeEnOrilla(laguna, hora({ vientoVelocidad: 30 }))).toEqual({
      altura: 0.43,
      periodo: 2.7,
      origen: "viento_local",
    });
  });

  it("la ola de la laguna es de periodo corto, y crece con el viento y el alcance", () => {
    const larga = { ...laguna, alcances: Array.from({ length: 37 }, () => 21_000) };

    expect(periodoConViento(laguna, 50)).toBeGreaterThan(periodoConViento(laguna, 20));
    expect(periodoConViento(larga, 30)).toBeGreaterThan(periodoConViento(laguna, 30));
    // Con 40 km/h y toda la laguna en contra se queda en 3,8 s; con 50 km/h llega a 4,1 s
    expect(periodoConViento(larga, 40)).toBe(3.8);
    expect(periodoConViento(larga, 50)).toBe(4.1);
  });

  it("con viento de tierra o sin viento no hay ola ni periodo", () => {
    expect(oleajeEnOrilla(laguna, hora({ vientoDireccion: 270 }))).toEqual({
      altura: 0,
      periodo: null,
      origen: "viento_local",
    });
    expect(oleajeEnOrilla(laguna, hora({ vientoVelocidad: 0 }))?.periodo).toBeNull();
  });

  it("ignora la ola del Mediterráneo: el modelo marino no cubre la laguna", () => {
    expect(oleajeEnOrilla(laguna, hora({ vientoVelocidad: 30, olaAltura: 3 }))?.altura).toBe(0.43);
    expect(oleajeEnOrilla(laguna, hora({ vientoVelocidad: 30, olaAltura: null }))?.altura).toBe(
      0.43,
    );
  });

  it("el viento de tierra no levanta ola en la orilla", () => {
    expect(
      oleajeEnOrilla(laguna, hora({ vientoVelocidad: 30, vientoDireccion: 270 }))?.altura,
    ).toBe(0);
  });

  it("crece con el viento y con el alcance", () => {
    const corta = { ...laguna, alcances: Array.from({ length: 37 }, () => 3000) };

    expect(alturaConViento(laguna, 40)).toBeGreaterThan(alturaConViento(laguna, 20));
    expect(alturaConViento(laguna, 20)).toBeGreaterThan(alturaConViento(corta, 20));
  });

  it("un rayo que se escapa por una gola cuenta como mucho lo que mide la laguna", () => {
    const fugada = { ...laguna, alcances: Array.from({ length: 37 }, () => 50_000) };
    const dentro = { ...laguna, alcances: Array.from({ length: 37 }, () => 21_000) };

    expect(oleajeEnOrilla(fugada, hora({ vientoVelocidad: 30 }))).toEqual(
      oleajeEnOrilla(dentro, hora({ vientoVelocidad: 30 })),
    );
  });

  it("sin datos del viento, no se sabe", () => {
    expect(oleajeEnOrilla(laguna, hora({ vientoVelocidad: null }))).toBeNull();
  });
});

describe("oleajeEnOrilla sin geografía", () => {
  it("sin orientación o sin alcances calculados, no se sabe", () => {
    expect(oleajeEnOrilla({ ...playaAbierta, mira: null }, hora({}))).toBeNull();
    expect(oleajeEnOrilla({ ...playaAbierta, alcances: null }, hora({}))).toBeNull();
  });
});
