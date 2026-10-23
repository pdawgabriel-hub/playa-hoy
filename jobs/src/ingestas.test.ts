import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registrarIngesta, resumirIngesta } from "./ingestas.ts";

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("registrarIngesta contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("una tarea sin errores queda como ok, con sus filas y sus horas", async () => {
    const antes = new Date();
    const registro = await registrarIngesta(conexion.db, "open_meteo", () =>
      Promise.resolve({ filas: 6660, errores: [] }),
    );

    expect(registro).toMatchObject({ fuente: "open_meteo", estado: "ok", filas: 6660 });
    expect(registro.empezadaEn.getTime()).toBeGreaterThanOrEqual(antes.getTime());
    expect(registro.terminadaEn.getTime()).toBeGreaterThanOrEqual(registro.empezadaEn.getTime());
  });

  it("una tarea que guarda algo pero tiene fallos queda como parcial", async () => {
    const registro = await registrarIngesta(conexion.db, "aemet", () =>
      Promise.resolve({ filas: 78, errores: ["playa 3000301: HTTP 500"] }),
    );

    expect(registro).toMatchObject({ estado: "parcial", errores: ["playa 3000301: HTTP 500"] });
  });

  it("una tarea que lanza un error queda como error y no lo relanza", async () => {
    const registro = await registrarIngesta(conexion.db, "aemet", () =>
      Promise.reject(new Error("AEMET no respondió")),
    );

    expect(registro).toMatchObject({ estado: "error", filas: 0, errores: ["AEMET no respondió"] });
  });

  it("de un AggregateError guarda cada error por separado", async () => {
    const registro = await registrarIngesta(conexion.db, "open_meteo", () =>
      Promise.reject(new AggregateError([new Error("Marine"), new Error("Forecast")])),
    );

    expect(registro.errores).toEqual(["Marine", "Forecast"]);
  });

  it("todas quedan guardadas en la tabla", async () => {
    const filas = await conexion.db.select().from(esquema.ingestas);

    expect(filas.map((f) => f.estado)).toEqual(["ok", "parcial", "error", "error"]);
  });
});

describe("resumirIngesta", () => {
  it("da el estado y debajo un error por línea", () => {
    const ahora = new Date();
    const texto = resumirIngesta({
      fuente: "aemet",
      empezadaEn: ahora,
      terminadaEn: ahora,
      estado: "parcial",
      filas: 78,
      errores: ["playa 3000301: HTTP 500"],
    });

    expect(texto).toBe("aemet: parcial, 78 filas\n  - playa 3000301: HTTP 500");
  });
});
