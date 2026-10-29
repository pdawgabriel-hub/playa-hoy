import { describe, expect, it } from "vitest";

import { simularAemet } from "../pruebas/aemet.ts";
import { consultarEstacionesAemet, leerObservaciones } from "./observaciones.ts";
import respuesta from "./pruebas/observacion-7019X.json" with { type: "json" };

// Respuesta real de AEMET (29/10/2026) para Cartagena/Salinas Cabo de Palos (7019X)
describe("leerObservaciones", () => {
  const observacion = leerObservaciones(respuesta);

  it("da la estación con su ubicación y su altitud", () => {
    expect(observacion).toMatchObject({
      id: "7019X",
      ubicacion: { lat: 37.635833, lon: -0.715556 },
      altitud: 2.5,
    });
  });

  it("lee las horas en UTC, en orden", () => {
    expect(observacion.horas).toHaveLength(12);
    expect(observacion.horas[0]?.hora).toEqual(new Date("2026-10-29T05:00:00Z"));
    expect(observacion.horas.at(-1)?.hora).toEqual(new Date("2026-10-29T16:00:00Z"));
  });

  it("pasa el viento de m/s a km/h, como la previsión", () => {
    // 05:00: vv 2,6 m/s, vmax 4 m/s, dv 254°
    expect(observacion.horas[0]).toMatchObject({
      vientoVelocidad: 9.4,
      vientoRacha: 14.4,
      vientoDireccion: 254,
    });
  });

  it("un dato que la estación no midió queda en nulo, no en 0", () => {
    // A las 05:00 la respuesta no trae temperatura
    expect(observacion.horas[0]?.temperaturaAire).toBeNull();
    expect(observacion.horas[1]?.temperaturaAire).toBe(18.2);
  });

  it("rechaza una hora que no está en UTC", () => {
    const [fila] = respuesta;
    expect(() => leerObservaciones([{ ...fila, fint: "2026-10-29T05:00:00+0200" }])).toThrow();
  });

  it("rechaza una respuesta vacía o con estaciones mezcladas", () => {
    const [fila] = respuesta;
    expect(() => leerObservaciones([])).toThrow(/ninguna/);
    expect(() => leerObservaciones([fila, { ...fila, idema: "7031X" }])).toThrow(/mezcló/);
  });
});

describe("consultarEstacionesAemet", () => {
  it("sigue los dos pasos y si falla una estación sigue con las demás", async () => {
    simularAemet({ caidas: ["7002Y"] });
    const { observaciones, errores } = await consultarEstacionesAemet(["7002Y", "7019X"], "clave", {
      intentos: 1,
      pausaMs: 1,
    });

    expect([...observaciones.keys()]).toEqual(["7019X"]);
    expect(errores).toEqual([expect.stringMatching(/^estación 7002Y: .*HTTP 500/)]);
  });
});
