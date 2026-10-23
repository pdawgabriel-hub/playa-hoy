import { describe, expect, it } from "vitest";

import { leerRespuestaMarine, urlMarine } from "./marine.ts";
import respuesta from "./pruebas/marine-dos-puntos.json" with { type: "json" };

// Respuesta real de Open-Meteo Marine (23/10/2026) para Las Gaviotas (La Manga) y
// Paseo de Manzanares (Mar Menor), un día
const PUNTOS = 2;

function primerPunto() {
  const [punto] = respuesta;
  if (!punto) throw new Error("La respuesta de prueba está vacía");
  return punto;
}

describe("urlMarine", () => {
  it("pide varias coordenadas a la vez, 10 días, en UTC y con horas en segundos", () => {
    const url = new URL(
      urlMarine([
        { lat: 37.7172, lon: -0.7407 },
        { lat: 37.7404, lon: -0.8488 },
      ]),
    );

    expect(url.origin + url.pathname).toBe("https://marine-api.open-meteo.com/v1/marine");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: "37.7172,37.7404",
      longitude: "-0.7407,-0.8488",
      hourly: "wave_height,wave_direction,wave_period,sea_surface_temperature",
      forecast_days: "10",
      timezone: "GMT",
      timeformat: "unixtime",
    });
  });
});

describe("leerRespuestaMarine", () => {
  const previsiones = leerRespuestaMarine(respuesta, PUNTOS);

  it("devuelve una previsión por punto, en el orden pedido, con la celda del modelo", () => {
    expect(previsiones).toHaveLength(2);
    expect(previsiones[0]?.celda).toEqual({ lat: 37.708336, lon: -0.70832825 });
    expect(previsiones[1]?.celda).toEqual({ lat: 37.625, lon: -0.87498474 });
  });

  it("convierte cada hora en una fila con los nombres de la tabla previsiones", () => {
    const primera = previsiones[0]?.horas[0];

    expect(previsiones[0]?.horas).toHaveLength(24);
    expect(primera?.hora.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(primera).toMatchObject({ olaAltura: 0.22 });
    expect(Object.keys(primera ?? {})).toEqual([
      "hora",
      "olaAltura",
      "olaDireccion",
      "olaPeriodo",
      "temperaturaAgua",
    ]);
  });

  it("acepta la respuesta de un solo punto, que llega como objeto y no como lista", () => {
    expect(leerRespuestaMarine(primerPunto(), 1)).toHaveLength(1);
  });

  it("conserva los nulos: más allá del horizonte del modelo no hay dato, no hay un 0", () => {
    const primero = primerPunto();
    const conHueco = {
      ...primero,
      hourly: {
        ...primero.hourly,
        wave_height: primero.hourly.wave_height.map((v, i) => (i === 5 ? null : v)),
      },
    };

    expect(leerRespuestaMarine(conHueco, 1)[0]?.horas[5]?.olaAltura).toBeNull();
  });

  it("falla si no devuelve tantos puntos como se pidieron", () => {
    expect(() => leerRespuestaMarine(respuesta, 3)).toThrow(/2 puntos y se pidieron 3/);
  });

  it("falla si una variable no tiene un valor por hora", () => {
    const cortada = structuredClone(primerPunto());
    cortada.hourly.wave_period.pop();

    expect(() => leerRespuestaMarine(cortada, 1)).toThrow(/wave_period tiene 23 valores/);
  });

  it("falla si la respuesta no está en UTC", () => {
    expect(() => leerRespuestaMarine({ ...primerPunto(), utc_offset_seconds: 7200 }, 1)).toThrow();
  });
});
