import { describe, expect, it } from "vitest";

import { giro, normalizarRumbo, separacion, vientoLocal } from "./angulos.ts";

describe("normalizarRumbo", () => {
  it("lleva cualquier ángulo a [0, 360)", () => {
    expect(normalizarRumbo(90)).toBe(90);
    expect(normalizarRumbo(-10)).toBe(350);
    expect(normalizarRumbo(725)).toBe(5);
  });

  it("deja intacto un rumbo que ya está en [0, 360), sin errores de coma flotante", () => {
    expect(normalizarRumbo(90.3)).toBe(90.3);
    expect(normalizarRumbo(359.9)).toBe(359.9);
  });

  it("360, -360 y un negativo muy pequeño son 0, nunca 360", () => {
    expect(normalizarRumbo(360)).toBe(0);
    expect(normalizarRumbo(-360)).toBe(0);
    expect(normalizarRumbo(-1e-14)).toBe(0);
  });
});

describe("giro", () => {
  it("toma el camino más corto, también al cruzar el norte", () => {
    expect(giro(350, 10)).toBe(20);
    expect(giro(10, 350)).toBe(-20);
    expect(giro(90, 45)).toBe(-45);
  });

  it("rumbos opuestos dan 180, nunca -180", () => {
    expect(giro(0, 180)).toBe(180);
    expect(giro(180, 0)).toBe(180);
  });

  it("acepta ángulos sin normalizar", () => {
    expect(giro(-10, 370)).toBe(20);
  });
});

describe("separacion", () => {
  it("es simétrica y va de 0 a 180", () => {
    expect(separacion(350, 10)).toBe(20);
    expect(separacion(10, 350)).toBe(20);
    expect(separacion(45, 45)).toBe(0);
    expect(separacion(90, 270)).toBe(180);
  });
});

describe("vientoLocal", () => {
  it("nombra el viento por el rumbo del que viene", () => {
    expect(vientoLocal(0)).toEqual({ nombre: "tramontana", punto: "N" });
    expect(vientoLocal(90)).toEqual({ nombre: "levante", punto: "E" });
    expect(vientoLocal(135)).toEqual({ nombre: "jaloque", punto: "SE" });
    expect(vientoLocal(225)).toEqual({ nombre: "lebeche", punto: "SO" });
    expect(vientoLocal(270)).toEqual({ nombre: "poniente", punto: "O" });
    expect(vientoLocal(315)).toEqual({ nombre: "mistral", punto: "NO" });
  });

  it("cada sector ocupa 45° centrados en su rumbo", () => {
    expect(vientoLocal(22.4).nombre).toBe("tramontana");
    expect(vientoLocal(22.5).nombre).toBe("gregal");
    expect(vientoLocal(337.4).nombre).toBe("mistral");
    expect(vientoLocal(337.5).nombre).toBe("tramontana");
    expect(vientoLocal(359.9).nombre).toBe("tramontana");
  });

  it("todo rumbo tiene nombre y da igual sumarle vueltas completas", () => {
    for (let rumbo = 0; rumbo < 360; rumbo += 0.5) {
      expect(vientoLocal(rumbo)).toEqual(vientoLocal(rumbo + 360));
      expect(vientoLocal(rumbo)).toEqual(vientoLocal(rumbo - 720));
    }
  });

  it("los ocho vientos aparecen y cada uno en un solo sector seguido", () => {
    const nombres = Array.from({ length: 360 }, (_, rumbo) => vientoLocal(rumbo).nombre);
    const tramos = nombres.filter((nombre, i) => nombre !== nombres[i - 1]);

    // Empieza y acaba en tramontana: el sector norte cruza el 0
    expect(tramos).toEqual([
      "tramontana",
      "gregal",
      "levante",
      "jaloque",
      "mediodía",
      "lebeche",
      "poniente",
      "mistral",
      "tramontana",
    ]);
  });
});
