import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { asc } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrevisionTiempo } from "./open-meteo/forecast.ts";
import type { PrevisionMarina } from "./open-meteo/marine.ts";
import {
  type FilaPrevision,
  aplicarRetencion,
  combinarPrevisiones,
  guardarPrevisiones,
  truncarHora,
} from "./previsiones.ts";

const celda = { lat: 37.7, lon: -0.7 };
const h = (iso: string) => new Date(`2026-10-23T${iso}:00Z`);

const marina = (horas: string[], olaAltura = 0.5): PrevisionMarina => ({
  celda,
  horas: horas.map((hora) => ({
    hora: h(hora),
    olaAltura,
    olaDireccion: 90,
    olaPeriodo: 4,
    temperaturaAgua: 21,
  })),
});

const tiempo = (horas: string[]): PrevisionTiempo => ({
  celdaViento: celda,
  celdaTiempo: celda,
  horas: horas.map((hora) => ({
    hora: h(hora),
    vientoVelocidad: 12,
    vientoDireccion: 80,
    vientoRacha: 20,
    temperaturaAire: 23,
    nubosidad: 30,
  })),
});

describe("truncarHora", () => {
  it("redondea hacia abajo a la hora en punto", () => {
    expect(truncarHora(new Date("2026-10-23T10:59:59.999Z"))).toEqual(h("10:00"));
  });
});

describe("combinarPrevisiones", () => {
  it("junta oleaje y tiempo de la misma hora en una fila", () => {
    const [fila] = combinarPrevisiones(7, h("10:00"), marina(["10:00"]), tiempo(["10:00"]));

    expect(fila).toEqual({
      puntoId: 7,
      emitidaEn: h("10:00"),
      hora: h("10:00"),
      vientoVelocidad: 12,
      vientoDireccion: 80,
      vientoRacha: 20,
      temperaturaAire: 23,
      nubosidad: 30,
      olaAltura: 0.5,
      olaDireccion: 90,
      olaPeriodo: 4,
      temperaturaAgua: 21,
    });
  });

  it("descarta las horas anteriores a la emisión", () => {
    const filas = combinarPrevisiones(
      1,
      h("10:00"),
      marina(["08:00", "09:00", "10:00", "11:00"]),
      tiempo(["08:00", "09:00", "10:00", "11:00"]),
    );

    expect(filas.map((f) => f.hora)).toEqual([h("10:00"), h("11:00")]);
  });

  it("una hora que solo está en una respuesta deja las otras variables en nulo", () => {
    const filas = combinarPrevisiones(1, h("10:00"), marina(["10:00"]), tiempo(["10:00", "11:00"]));

    expect(filas[1]).toMatchObject({ hora: h("11:00"), vientoVelocidad: 12, olaAltura: null });
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("guardar previsiones contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let puntoId = 0;

  const emision = (emitidaEn: string, horas: string[], olaAltura = 0.5): FilaPrevision[] =>
    combinarPrevisiones(puntoId, h(emitidaEn), marina(horas, olaAltura), tiempo(horas));

  const guardadas = async () =>
    conexion.db
      .select({
        emitidaEn: esquema.previsiones.emitidaEn,
        hora: esquema.previsiones.hora,
        olaAltura: esquema.previsiones.olaAltura,
      })
      .from(esquema.previsiones)
      .orderBy(asc(esquema.previsiones.hora), asc(esquema.previsiones.emitidaEn));

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const [punto] = await conexion.db
      .insert(esquema.puntosConsulta)
      .values({ celdas: "a|b|c", ubicacion: { x: -0.7, y: 37.7 } })
      .returning({ id: esquema.puntosConsulta.id });
    puntoId = punto?.id ?? 0;
  });

  beforeEach(async () => {
    await conexion.db.delete(esquema.previsiones);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("repetir la misma emisión no duplica filas y deja los valores nuevos", async () => {
    await guardarPrevisiones(conexion.db, emision("10:00", ["10:00", "11:00"]));
    await guardarPrevisiones(conexion.db, emision("10:00", ["10:00", "11:00"], 0.8));

    const filas = await guardadas();
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.olaAltura === 0.8)).toBe(true);
  });

  it("emisiones distintas de la misma hora se guardan todas", async () => {
    await guardarPrevisiones(conexion.db, emision("10:00", ["12:00"]));
    await guardarPrevisiones(conexion.db, emision("11:00", ["12:00"]));

    expect(await guardadas()).toHaveLength(2);
  });

  it("la base de datos rechaza una hora anterior a su emisión", async () => {
    await expect(
      guardarPrevisiones(conexion.db, [{ puntoId, emitidaEn: h("10:00"), hora: h("09:00") }]),
    ).rejects.toThrow();
  });

  it("la retención deja solo la última emisión de las horas antiguas", async () => {
    for (const emitida of ["06:00", "08:00", "10:00"]) {
      await guardarPrevisiones(conexion.db, emision(emitida, ["10:00", "18:00"]));
    }

    // A 14 días y 14 horas de la emisión: las 10:00 quedan fuera del plazo, las 18:00 no
    const ahora = new Date(h("00:00").getTime() + (14 * 24 + 14) * 3_600_000);
    expect(await aplicarRetencion(conexion.db, ahora)).toBe(2);

    const filas = await guardadas();
    expect(filas.filter((f) => f.hora.getTime() === h("10:00").getTime())).toEqual([
      { emitidaEn: h("10:00"), hora: h("10:00"), olaAltura: 0.5 },
    ]);
    expect(filas.filter((f) => f.hora.getTime() === h("18:00").getTime())).toHaveLength(3);
  });

  it("aplicar la retención dos veces no borra más", async () => {
    await guardarPrevisiones(conexion.db, emision("06:00", ["10:00"]));
    await guardarPrevisiones(conexion.db, emision("08:00", ["10:00"]));
    const ahora = new Date(h("00:00").getTime() + 30 * 24 * 3_600_000);

    expect(await aplicarRetencion(conexion.db, ahora)).toBe(1);
    expect(await aplicarRetencion(conexion.db, ahora)).toBe(0);
    expect(await guardadas()).toHaveLength(1);
  });
});
