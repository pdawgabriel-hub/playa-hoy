import { describe, expect, it } from "vitest";

import { ortoYOcaso } from "./luz.ts";

// Cartagena
const LAT = 37.6;
const LON = -0.98;

// Referencia: Open-Meteo (API de históricos, daily=sunrise,sunset), en UTC y al minuto
const REFERENCIA = [
  { dia: "2025-06-21", orto: "04:42", ocaso: "19:28" },
  { dia: "2025-12-21", orto: "07:15", ocaso: "16:48" },
  // Días de cambio de hora: en UTC no se nota
  { dia: "2025-03-30", orto: "05:52", ocaso: "18:24" },
  { dia: "2025-10-26", orto: "06:23", ocaso: "17:12" },
];

const minutosDeDiferencia = (calculada: Date, dia: string, hora: string) =>
  Math.abs(calculada.getTime() - Date.parse(`${dia}T${hora}:00Z`)) / 60_000;

// Horas de luz de un día en Cartagena
const duracion = (dia: string) => {
  const luz = ortoYOcaso(dia, LAT, LON);
  return ((luz?.ocaso.getTime() ?? 0) - (luz?.orto.getTime() ?? 0)) / 3_600_000;
};

describe("ortoYOcaso", () => {
  it.each(REFERENCIA)("el $dia acierta al minuto o dos", ({ dia, orto, ocaso }) => {
    const luz = ortoYOcaso(dia, LAT, LON);

    expect(minutosDeDiferencia(luz?.orto ?? new Date(0), dia, orto)).toBeLessThan(2);
    expect(minutosDeDiferencia(luz?.ocaso ?? new Date(0), dia, ocaso)).toBeLessThan(2);
  });

  it("en Murcia, el día dura unas 14 h 45 min en junio y 9 h 30 min en diciembre", () => {
    expect(duracion("2025-06-21")).toBeCloseTo(14.75, 0);
    expect(duracion("2025-12-21")).toBeCloseTo(9.55, 0);
  });

  it("más al oeste, el sol sale más tarde", () => {
    const aguilas = ortoYOcaso("2025-06-21", 37.4, -1.58);
    const cartagena = ortoYOcaso("2025-06-21", LAT, LON);

    expect(aguilas?.orto.getTime()).toBeGreaterThan(cartagena?.orto.getTime() ?? 0);
  });

  it("en el círculo polar, en junio el sol no se pone", () => {
    expect(ortoYOcaso("2025-06-21", 78, 15)).toBeNull();
  });

  it("rechaza un día que no es una fecha", () => {
    expect(() => ortoYOcaso("ayer", LAT, LON)).toThrow(/no válido/);
  });
});
