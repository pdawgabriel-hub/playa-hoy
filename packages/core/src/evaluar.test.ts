import { describe, expect, it } from "vitest";

import { type HoraPrevision, type PlayaEvaluada, evaluarPlaya } from "./evaluar.ts";

const HORA_MS = 3_600_000;
const INICIO = new Date("2026-07-15T00:00:00Z");
const ESTE = 90;

// Playa del Mediterráneo que mira al este, con mar abierto
const PLAYA: PlayaEvaluada = {
  mira: ESTE,
  laguna: false,
  alcances: Array.from({ length: 37 }, () => 50_000),
  suelo: "arena_fina",
  socorrista: true,
};

const hora = (i: number, cambios: Partial<HoraPrevision> = {}): HoraPrevision => ({
  hora: new Date(INICIO.getTime() + i * HORA_MS),
  olaAltura: 0.1,
  olaDireccion: ESTE,
  olaPeriodo: 5,
  vientoVelocidad: 8,
  vientoDireccion: ESTE,
  temperaturaAire: 27,
  temperaturaAgua: 25,
  nubosidad: 10,
  ...cambios,
});

const serie = (n: number, cambios: (i: number) => Partial<HoraPrevision> = () => ({})) =>
  Array.from({ length: n }, (_, i) => hora(i, cambios(i)));

describe("evaluarPlaya", () => {
  it("evalúa solo las horas desde `desde`, en orden", () => {
    const desde = new Date(INICIO.getTime() + 48 * HORA_MS);
    const evaluadas = evaluarPlaya(PLAYA, serie(72).toReversed(), desde);

    expect(evaluadas).toHaveLength(24);
    expect(evaluadas[0]?.hora).toEqual(desde);
    expect(evaluadas.every((h, i) => i === 0 || h.hora > (evaluadas[i - 1]?.hora ?? 0))).toBe(true);
  });

  it("da las cuatro notas con sus razones, la bandera y las condiciones de la hora", () => {
    const [h] = evaluarPlaya(PLAYA, serie(1), INICIO);

    expect(h?.notas.familia?.nota).toBe(100);
    expect(h?.notas.familia?.razones[0]).toEqual({
      tipo: "a_favor",
      factor: "ola",
      texto: "Poca ola en la orilla (0,1 m)",
    });
    expect(h?.notas.surf?.nota).toBe(0);
    expect(h?.bandera).toEqual({ bandera: "verde", motivos: [] });
    expect(h?.condiciones).toMatchObject({
      olaOrilla: 0.1,
      entradaViento: "mar",
      suelo: "arena_fina",
    });
  });

  it("la claridad usa las horas previas: tras un temporal el agua sigue turbia", () => {
    // 24 horas de temporal de 1,5 m y después mar plano
    const horas = serie(36, (i) => ({ olaAltura: i < 24 ? 1.5 : 0.1 }));
    const desde = new Date(INICIO.getTime() + 24 * HORA_MS);
    const [primera] = evaluarPlaya(PLAYA, horas, desde);

    expect(primera?.condiciones.olaOrilla).toBe(0.1);
    expect(primera?.claridad?.estado).toBe("turbia");
    // Mar plano, pero agua turbia: snorkel descartado
    expect(primera?.notas.snorkel?.nota).toBe(0);
    expect(primera?.notas.snorkel?.razones[0]?.tipo).toBe("descarta");
  });

  it("sin datos para un plan, su nota es null y las demás siguen", () => {
    const [h] = evaluarPlaya(
      PLAYA,
      serie(1, () => ({ nubosidad: null })),
      INICIO,
    );

    expect(h?.notas.sol).toBeNull();
    expect(h?.notas.familia).not.toBeNull();
  });

  it("en el Mar Menor la ola sale del viento local y el periodo corto descarta el surf", () => {
    const laguna: PlayaEvaluada = {
      ...PLAYA,
      laguna: true,
      alcances: Array.from({ length: 37 }, () => 10_000),
    };
    const [h] = evaluarPlaya(
      laguna,
      serie(1, () => ({ vientoVelocidad: 30, olaAltura: 2 })),
      INICIO,
    );

    expect(h?.condiciones.olaOrilla).toBe(0.43);
    expect(h?.condiciones.olaPeriodo).toBe(2.7);
    expect(h?.notas.surf?.nota).toBe(0);
  });

  it("sin geografía de la playa no hay ola en la orilla ni notas que la necesiten", () => {
    const [h] = evaluarPlaya({ ...PLAYA, mira: null }, serie(1), INICIO);

    expect(h?.condiciones.olaOrilla).toBeNull();
    expect(h?.notas.familia).toBeNull();
    expect(h?.notas.sol).not.toBeNull();
  });
});
