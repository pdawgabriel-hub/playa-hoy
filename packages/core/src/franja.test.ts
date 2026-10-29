import { describe, expect, it } from "vitest";

import { type NotaHora, mejorFranja } from "./franja.ts";
import { ortoYOcaso } from "./luz.ts";

const DIA = "2026-07-15";
// En Cartagena, el 15 de julio: sale a las 4:54 UTC y se pone a las 19:25
const LUZ = ortoYOcaso(DIA, 37.6, -0.98) ?? { orto: new Date(0), ocaso: new Date(0) };

const h = (hora: number) => new Date(`${DIA}T${String(hora).padStart(2, "0")}:00:00Z`);
// Una nota por hora, de las 0 a las 23 UTC
const dia = (notas: (number | null)[]): NotaHora[] =>
  notas.map((nota, hora) => ({ hora: h(hora), nota }));

describe("mejorFranja", () => {
  it("encuentra las tres horas seguidas de mejor media", () => {
    const notas = Array.from({ length: 24 }, () => 50);
    notas[10] = 80;
    notas[11] = 90;
    notas[12] = 85;

    expect(mejorFranja(dia(notas), LUZ)).toEqual({ inicio: h(10), fin: h(13), nota: 85 });
  });

  it("no cuenta las horas de noche, aunque tengan mejor nota", () => {
    const notas = Array.from({ length: 24 }, (_, hora) => (hora < 5 || hora >= 20 ? 100 : 40));
    const franja = mejorFranja(dia(notas), LUZ);

    expect(franja?.nota).toBe(40);
    expect(franja?.inicio.getTime()).toBeGreaterThanOrEqual(LUZ.orto.getTime());
    expect(franja?.fin.getTime()).toBeLessThanOrEqual(LUZ.ocaso.getTime());
  });

  it("una hora cuenta si entera es de día: la de las 4 (sale a las 4:54) no, la de las 5 sí", () => {
    const notas = Array.from({ length: 24 }, () => 10);
    notas[4] = 100;
    notas[5] = 90;
    notas[6] = 90;
    notas[7] = 90;

    expect(mejorFranja(dia(notas), LUZ)?.inicio).toEqual(h(5));
  });

  it("si empatan, la más temprana", () => {
    expect(mejorFranja(dia(Array.from({ length: 24 }, () => 70)), LUZ)?.inicio).toEqual(h(5));
  });

  it("no junta horas separadas por un hueco sin dato", () => {
    const notas: (number | null)[] = Array.from({ length: 24 }, () => 20);
    notas[10] = 90;
    notas[11] = null;
    notas[12] = 90;
    notas[13] = 90;
    notas[14] = 90;

    expect(mejorFranja(dia(notas), LUZ)).toEqual({ inicio: h(12), fin: h(15), nota: 90 });
  });

  it("da igual el orden en que lleguen las horas", () => {
    const notas = Array.from({ length: 24 }, (_, hora) => (hora >= 14 && hora <= 16 ? 95 : 30));

    expect(mejorFranja(dia(notas).toReversed(), LUZ)).toEqual(mejorFranja(dia(notas), LUZ));
  });

  it("sin tres horas seguidas de día con nota, no hay franja", () => {
    expect(mejorFranja(dia([...Array.from({ length: 12 }, () => null), 80, 80]), LUZ)).toBeNull();
    expect(mejorFranja([], LUZ)).toBeNull();
  });

  it("si todo el día da 0, no hay franja que recomendar", () => {
    expect(mejorFranja(dia(Array.from({ length: 24 }, () => 0)), LUZ)).toBeNull();
  });

  it("redondea la media", () => {
    const notas = Array.from({ length: 24 }, () => 0);
    notas[10] = 70;
    notas[11] = 71;
    notas[12] = 71;

    expect(mejorFranja(dia(notas), LUZ)?.nota).toBe(71);
  });
});
