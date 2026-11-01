import { esquema, asc, eq } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { calcularNotas } from "./notas.ts";

const url = process.env.DATABASE_URL ?? "";
const HORA_MS = 3_600_000;
// 10:20 UTC del 30 de octubre de 2026: se calcula desde las 10:00
const AHORA = new Date("2026-10-30T10:20:00Z");
const DESDE = new Date("2026-10-30T10:00:00Z");
// Previsión de 96 horas antes a 24 horas después
const HORAS = Array.from({ length: 121 }, (_, i) => new Date(DESDE.getTime() + (i - 96) * HORA_MS));

describe.skipIf(!url)("calcularNotas contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let mediterraneo = 0;
  let laguna = 0;

  const condicionesDe = (playaId: number) =>
    conexion.db
      .select()
      .from(esquema.condiciones)
      .where(eq(esquema.condiciones.playaId, playaId))
      .orderBy(asc(esquema.condiciones.hora));

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const { db } = conexion;
    await db
      .insert(esquema.municipios)
      .values({ id: "30016", nombre: "Cartagena", slug: "cartagena" });
    const [punto] = await db
      .insert(esquema.puntosConsulta)
      .values({ celdas: "a|b|c", ubicacion: { x: -0.75, y: 37.7 } })
      .returning({ id: esquema.puntosConsulta.id });
    const playas = await db
      .insert(esquema.playas)
      .values(
        [false, true].map((esLaguna, i) => ({
          nombre: `Playa ${i.toString()}`,
          slug: `playa-${i.toString()}`,
          municipioId: "30016",
          ubicacion: { x: -0.75 - i / 100, y: 37.7 },
          codigoCenso: `ES620M000000${i.toString()}`,
          codigoAemet: esLaguna ? "3001676" : null,
          mira: 90,
          laguna: esLaguna,
          alcances: Array.from({ length: 37 }, () => (esLaguna ? 10_000 : 50_000)),
          puntoConsultaId: punto?.id ?? 0,
        })),
      )
      .returning({ id: esquema.playas.id });
    mediterraneo = playas[0]?.id ?? 0;
    laguna = playas[1]?.id ?? 0;
    await db.insert(esquema.playaServicios).values({
      playaId: mediterraneo,
      suelo: "roca",
      socorrista: true,
      fuentes: ["itrem"],
    });

    // Dos emisiones: la de hace 6 horas y la actual, que es la que debe usarse
    for (const [emitidaEn, olaAltura] of [
      [new Date(DESDE.getTime() - 6 * HORA_MS), 1.5],
      [DESDE, 0.1],
    ] as const) {
      await db.insert(esquema.previsiones).values(
        HORAS.filter((hora) => hora >= emitidaEn).map((hora) => ({
          puntoId: punto?.id ?? 0,
          emitidaEn,
          hora,
          olaAltura,
          olaDireccion: 90,
          olaPeriodo: 5,
          vientoVelocidad: 8,
          vientoDireccion: 90,
          temperaturaAire: 22,
          temperaturaAgua: 23.5,
          nubosidad: 20,
        })),
      );
    }
    // Las horas pasadas, de la emisión que las cubría: mar plano
    await db.insert(esquema.previsiones).values(
      HORAS.filter((hora) => hora < new Date(DESDE.getTime() - 6 * HORA_MS)).map((hora) => ({
        puntoId: punto?.id ?? 0,
        emitidaEn: hora,
        hora,
        olaAltura: 0.1,
        olaDireccion: 90,
        olaPeriodo: 5,
        vientoVelocidad: 8,
        vientoDireccion: 90,
        temperaturaAire: 22,
        temperaturaAgua: 23.5,
        nubosidad: 20,
      })),
    );
    // AEMET: 20 °C en la laguna hoy
    await db.insert(esquema.previsionesAemet).values({
      playaId: laguna,
      fecha: "2026-10-30",
      elaboradaEn: new Date("2026-10-30T06:51:00Z"),
      temperaturaAgua: 20,
      temperaturaMaxima: 24,
      uvMaximo: 4,
    });
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("calcula desde la hora actual hasta donde llega la previsión, para cada playa", async () => {
    const resumen = await calcularNotas(conexion.db, { ahora: AHORA });

    // 25 horas (de las 10:00 a las 10:00 del día siguiente) por 2 playas
    expect(resumen).toMatchObject({ playas: 2, horas: 50 });
    const horas = await condicionesDe(mediterraneo);
    expect(horas[0]?.hora).toEqual(DESDE);
    expect(horas).toHaveLength(25);
  });

  it("usa la última emisión de cada hora", async () => {
    const [primera] = await condicionesDe(mediterraneo);

    expect(primera).toMatchObject({ olaOrilla: 0.1, emitidaEn: DESDE, bandera: "verde" });
  });

  it("la claridad usa las horas previas, con la emisión que las cubría", async () => {
    // Las 6 horas anteriores, de la emisión antigua, traían 1,5 m: el agua aún no está clara
    const [primera] = await condicionesDe(mediterraneo);

    expect(primera?.estadoAgua).not.toBe("cristalina");
  });

  it("guarda las notas de los cuatro planes con sus razones", async () => {
    const notas = await conexion.db
      .select()
      .from(esquema.notas)
      .where(eq(esquema.notas.hora, DESDE))
      .orderBy(asc(esquema.notas.playaId), asc(esquema.notas.perfil));
    const delMediterraneo = notas.filter((n) => n.playaId === mediterraneo);

    expect(delMediterraneo.map((n) => n.perfil)).toEqual(["familia", "snorkel", "sol", "surf"]);
    expect(delMediterraneo[0]?.razones).toContainEqual({
      tipo: "a_favor",
      factor: "ola",
      texto: "Poca ola en la orilla (0,1 m)",
    });
    expect(delMediterraneo.find((n) => n.perfil === "surf")?.nota).toBe(0);
  });

  it("en el Mar Menor usa la temperatura del agua de AEMET; en el Mediterráneo, la de Open-Meteo", async () => {
    const [deLaguna] = await condicionesDe(laguna);
    const [delMediterraneo] = await condicionesDe(mediterraneo);

    expect(deLaguna).toMatchObject({ temperaturaAgua: 20, fuenteTemperaturaAgua: "aemet" });
    expect(delMediterraneo).toMatchObject({
      temperaturaAgua: 23.5,
      fuenteTemperaturaAgua: "open_meteo",
    });
  });

  it("los días sin dato de AEMET, la laguna usa Open-Meteo", async () => {
    const horas = await condicionesDe(laguna);
    const manana = horas.find((h) => h.hora.toISOString() === "2026-10-31T10:00:00.000Z");

    expect(manana).toMatchObject({ temperaturaAgua: 23.5, fuenteTemperaturaAgua: "open_meteo" });
  });

  it("repetirlo sustituye el cálculo, sin duplicar", async () => {
    await calcularNotas(conexion.db, { ahora: AHORA });

    expect(await conexion.db.$count(esquema.condiciones)).toBe(50);
  });

  it("una hora después, la hora que ya pasó desaparece", async () => {
    await calcularNotas(conexion.db, { ahora: new Date(AHORA.getTime() + HORA_MS) });
    const horas = await condicionesDe(mediterraneo);

    expect(horas[0]?.hora).toEqual(new Date(DESDE.getTime() + HORA_MS));
    expect(await conexion.db.$count(esquema.condiciones)).toBe(48);
  });
});
