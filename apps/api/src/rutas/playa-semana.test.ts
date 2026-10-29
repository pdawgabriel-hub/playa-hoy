import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { crearApp } from "../app.ts";

const url = process.env.DATABASE_URL ?? "";
const HORA_MS = 3_600_000;
// Las 00:00 del 15 de julio de 2026 en España (UTC+2)
const INICIO = Date.parse("2026-07-14T22:00:00Z");
const hora = (i: number) => new Date(INICIO + i * HORA_MS);
// Hora local de España de la hora i (en julio, UTC+2)
const local = (i: number) => i % 24;
// 2 días enteros y 6 horas del tercero
const HORAS = 54;
const deNoche = (i: number) => local(i) < 7 || local(i) >= 21;

const EsquemaRespuesta = z.object({
  playa: z.object({ nombre: z.string() }),
  dias: z.array(
    z.object({
      fecha: z.string(),
      franjas: z.looseObject({}),
      notaMaxima: z.object({
        familia: z.number().nullable(),
        snorkel: z.number().nullable(),
        sol: z.number().nullable(),
        surf: z.number().nullable(),
      }),
      condiciones: z.looseObject({ banderaPeor: z.string().nullable() }),
    }),
  ),
});

describe.skipIf(!url)("GET /v1/playas/{id}/semana contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let playaId = 0;

  // Por defecto, a las 10:00 en España del 15 de julio
  const semana = async (id = playaId, ahora = new Date("2026-07-15T08:00:00Z")) => {
    const app = crearApp(conexion.db, { reloj: () => ahora });
    return app.request(`/v1/playas/${id.toString()}/semana`);
  };
  const dias = async (ahora?: Date) =>
    EsquemaRespuesta.parse(await (await semana(playaId, ahora)).json()).dias;

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const { db } = conexion;
    await db
      .insert(esquema.municipios)
      .values({ id: "30016", nombre: "Cartagena", slug: "cartagena" });
    const [punto] = await db
      .insert(esquema.puntosConsulta)
      .values({ celdas: "a|b|c", ubicacion: { x: -0.98, y: 37.6 } })
      .returning({ id: esquema.puntosConsulta.id });
    const [playa] = await db
      .insert(esquema.playas)
      .values({
        nombre: "El Portús",
        slug: "el-portus",
        municipioId: "30016",
        ubicacion: { x: -0.98, y: 37.6 },
        codigoCenso: "ES620M0000001",
        puntoConsultaId: punto?.id ?? 0,
      })
      .returning({ id: esquema.playas.id });
    playaId = playa?.id ?? 0;
    await db.insert(esquema.playaServicios).values({ playaId, socorrista: true, fuentes: ["osm"] });
    const emitidaEn = new Date(INICIO - HORA_MS);

    await db.insert(esquema.previsiones).values(
      Array.from({ length: HORAS }, (_, i) => ({
        puntoId: punto?.id ?? 0,
        emitidaEn,
        hora: hora(i),
        vientoVelocidad: 10 + local(i),
        temperaturaAire: 20 + local(i) / 2,
        nubosidad: 0,
      })),
    );
    await db.insert(esquema.condiciones).values(
      Array.from({ length: HORAS }, (_, i) => ({
        playaId,
        hora: hora(i),
        olaOrilla: i < 24 ? 0.2 : 0.6,
        temperaturaAgua: 24,
        // El día 16, amarilla a mediodía; de noche, roja (no debe contar)
        bandera: deNoche(i)
          ? ("roja" as const)
          : i >= 24 && local(i) === 13
            ? ("amarilla" as const)
            : ("verde" as const),
        emitidaEn,
      })),
    );
    await db.insert(esquema.notas).values(
      Array.from({ length: HORAS }, (_, i) => ({
        playaId,
        perfil: "sol",
        hora: hora(i),
        // De noche, 100 (no debe contar); de día, 60 y 80 a las 12:00
        nota: deNoche(i) ? 100 : local(i) === 12 ? 80 : 60,
        emitidaEn,
      })),
    );
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("da un resumen por día con previsión y horas de día, en hora de España", async () => {
    // Del 17 solo hay previsión de las 00:00 a las 05:00, de noche: no aparece
    expect((await dias()).map((d) => d.fecha)).toEqual(["2026-07-15", "2026-07-16"]);
  });

  it("a última hora de la tarde, hoy ya no aparece: no le queda ninguna hora de día", async () => {
    // Las 22:30 en España
    const fechas = (await dias(new Date("2026-07-15T20:30:00Z"))).map((d) => d.fecha);

    expect(fechas[0]).toBe("2026-07-16");
  });

  it("la nota máxima de cada plan solo cuenta las horas de día", async () => {
    const [primero] = await dias();

    expect(primero?.notaMaxima).toEqual({ familia: null, snorkel: null, sol: 80, surf: null });
  });

  it("la peor bandera del día, sin contar la noche", async () => {
    const [primero, segundo] = await dias();

    expect(primero?.condiciones.banderaPeor).toBe("verde");
    expect(segundo?.condiciones.banderaPeor).toBe("amarilla");
  });

  it("resume las condiciones de las horas de día", async () => {
    const [primero, segundo] = await dias();

    expect(primero?.condiciones).toMatchObject({
      olaOrillaMaxima: 0.2,
      temperaturaAgua: 24,
      // Hoy quedan de día de las 10:00 (la hora en curso) a las 20:00: viento hasta 30 km/h,
      // aire de 25 a 30 °C
      vientoMaximo: 30,
      temperaturaAireMinima: 25,
      temperaturaAireMaxima: 30,
    });
    expect(segundo?.condiciones.olaOrillaMaxima).toBe(0.6);
  });

  it("cada día lleva su mejor franja de cada plan", async () => {
    const [primero] = await dias();

    // Las tres franjas con las 12:00 (80) empatan a 67 (60, 80 y 60): gana la más temprana
    expect(primero?.franjas).toMatchObject({
      sol: { inicioLocal: "10:00", finLocal: "13:00", nota: 67 },
      familia: null,
    });
  });

  it("una playa que no existe da 404", async () => {
    expect((await semana(999_999)).status).toBe(404);
  });
});
