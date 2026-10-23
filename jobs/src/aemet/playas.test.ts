import { describe, expect, it } from "vitest";

import { PREDICCION_MANZANARES, simularAemet } from "../pruebas/aemet.ts";
import { consultarPlayasAemet, leerPrediccionPlaya } from "./playas.ts";

// Respuesta real de AEMET (23/10/2026) para Paseo de Manzanares (3090206), en ISO-8859-15,
// tal como llega
const DATOS: unknown = JSON.parse(new TextDecoder("iso-8859-15").decode(PREDICCION_MANZANARES));

describe("leerPrediccionPlaya", () => {
  const prediccion = leerPrediccionPlaya(DATOS);

  it("lee los tres días con fechas en formato ISO", () => {
    expect(prediccion.nombre).toBe("Manzanares");
    expect(prediccion.dias.map((d) => d.fecha)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]);
  });

  it("pasa la hora de elaboración, en hora de España, a UTC", () => {
    expect(prediccion.elaborado).toEqual(new Date("2026-10-23T06:51:16Z"));
  });

  it("da la temperatura del agua, la máxima y el UV de cada día", () => {
    const [hoy] = prediccion.dias;

    expect(typeof hoy?.temperaturaAgua).toBe("number");
    expect(typeof hoy?.temperaturaMaxima).toBe("number");
    expect(typeof hoy?.uvMaximo).toBe("number");
  });

  it("da el cielo, el viento y el oleaje de mañana y tarde por categorías", () => {
    expect(Object.keys(prediccion.dias[0]?.oleaje ?? {})).toEqual(["manana", "tarde"]);
  });

  it("rechaza una respuesta con otra forma", () => {
    expect(() => leerPrediccionPlaya([{ nombre: "X" }])).toThrow();
    expect(() => leerPrediccionPlaya([])).toThrow();
  });
});

describe("consultarPlayasAemet", () => {
  it("sigue los dos pasos y devuelve la predicción de cada playa", async () => {
    simularAemet();
    const { predicciones, errores } = await consultarPlayasAemet(
      ["3090206", "3001676"],
      "clave-secreta",
      { pausaMs: 1 },
    );

    expect([...predicciones.keys()]).toEqual(["3090206", "3001676"]);
    expect(predicciones.get("3090206")?.dias).toHaveLength(3);
    expect(errores).toEqual([]);
  });

  it("manda la clave en la cabecera y nunca en la URL", async () => {
    const peticiones = simularAemet();
    await consultarPlayasAemet(["3090206"], "clave-secreta", { pausaMs: 1 });

    expect(peticiones.map((p) => p.clave)).toEqual(["clave-secreta"]);
    expect(peticiones.some((p) => p.url.includes("clave"))).toBe(false);
  });

  it("si la clave no vale, para en la primera playa en lugar de probar todas", async () => {
    const peticiones = simularAemet({ clave: "clave-buena" });

    await expect(
      consultarPlayasAemet(["3090206", "3001676"], "clave-caducada", { pausaMs: 1 }),
    ).rejects.toMatchObject({ estado: 401 });
    expect(peticiones).toHaveLength(1);
  });

  it("si AEMET no tiene datos de una playa, lo apunta y sigue con las demás", async () => {
    simularAemet({ sinDatos: ["0000000"] });
    const { predicciones, errores } = await consultarPlayasAemet(["0000000", "3090206"], "clave", {
      intentos: 1,
      pausaMs: 1,
    });

    expect([...predicciones.keys()]).toEqual(["3090206"]);
    expect(errores).toEqual([expect.stringMatching(/^playa 0000000: .*404 No hay datos/)]);
  });
});
