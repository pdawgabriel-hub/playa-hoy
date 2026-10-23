import { describe, expect, it } from "vitest";

import { leerRespuestaForecast, urlForecast } from "./forecast.ts";
import tiempo from "./pruebas/forecast-tiempo-dos-puntos.json" with { type: "json" };
import viento from "./pruebas/forecast-viento-dos-puntos.json" with { type: "json" };

// Respuestas reales de Open-Meteo Forecast (23/10/2026) para Las Gaviotas (La Manga) y
// Paseo de Manzanares (Mar Menor), un día: viento con la celda de mar, tiempo con la de tierra
const PUNTOS = 2;
const COORDENADAS = [
  { lat: 37.7172, lon: -0.7407 },
  { lat: 37.7404, lon: -0.8488 },
];

describe("urlForecast", () => {
  it("pide el viento a la celda de mar, en km/h", () => {
    const parametros = new URL(urlForecast(COORDENADAS, "viento")).searchParams;

    expect(parametros.get("hourly")).toBe("wind_speed_10m,wind_direction_10m,wind_gusts_10m");
    expect(parametros.get("cell_selection")).toBe("sea");
    expect(parametros.get("wind_speed_unit")).toBe("kmh");
  });

  it("pide la temperatura y las nubes a la celda de tierra", () => {
    const parametros = new URL(urlForecast(COORDENADAS, "tiempo")).searchParams;

    expect(parametros.get("hourly")).toBe("temperature_2m,cloud_cover");
    expect(parametros.get("cell_selection")).toBe("land");
  });

  it("10 días, varias coordenadas, en UTC y con horas en segundos, igual que Marine", () => {
    const parametros = Object.fromEntries(new URL(urlForecast(COORDENADAS, "viento")).searchParams);

    expect(parametros).toMatchObject({
      latitude: "37.7172,37.7404",
      longitude: "-0.7407,-0.8488",
      forecast_days: "10",
      timezone: "GMT",
      timeformat: "unixtime",
    });
  });
});

describe("leerRespuestaForecast", () => {
  const previsiones = leerRespuestaForecast(viento, tiempo, PUNTOS);

  it("combina viento y tiempo en una fila por hora con los nombres de la tabla previsiones", () => {
    const primera = previsiones[0]?.horas[0];

    expect(previsiones).toHaveLength(2);
    expect(previsiones[0]?.horas).toHaveLength(24);
    expect(primera?.hora.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(Object.keys(primera ?? {})).toEqual([
      "hora",
      "vientoVelocidad",
      "vientoDireccion",
      "vientoRacha",
      "temperaturaAire",
      "nubosidad",
    ]);
  });

  it("devuelve la celda de cada petición: la de tierra de La Manga cae en tierra firme", () => {
    expect(previsiones[0]?.celdaViento).toEqual({ lat: 37.724228, lon: -0.71400803 });
    expect(previsiones[0]?.celdaTiempo).toEqual({ lat: 37.641235, lon: -0.7679191 });
  });

  it("falla si las horas del viento y del tiempo no coinciden", () => {
    const desfasado = tiempo.map((p) => ({
      ...p,
      hourly: { ...p.hourly, time: p.hourly.time.map((t) => t + 3600) },
    }));

    expect(() => leerRespuestaForecast(viento, desfasado, PUNTOS)).toThrow(/no coinciden/);
  });

  it("falla si falta un punto en una de las dos respuestas", () => {
    expect(() => leerRespuestaForecast(viento, tiempo.slice(0, 1), PUNTOS)).toThrow(
      /tiempo\) devolvió 1 puntos/,
    );
  });
});
