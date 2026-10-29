import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { crearApp } from "../app.ts";

const url = process.env.DATABASE_URL ?? "";
const HORA_MS = 3_600_000;
// El 15 de julio de 2026 en hora de España (UTC+2) va de las 22:00 UTC del 14 a las 22:00 del 15
const INICIO_DIA = Date.parse("2026-07-14T22:00:00Z");
const hora = (i: number) => new Date(INICIO_DIA + i * HORA_MS);

const EsquemaRespuesta = z.object({
  playa: z.object({ id: z.number(), nombre: z.string() }),
  fecha: z.string(),
  luz: z.object({ ortoLocal: z.string(), ocasoLocal: z.string() }).nullable(),
  horas: z.array(
    z.looseObject({
      hora: z.string(),
      horaLocal: z.string(),
      deDia: z.boolean(),
      bandera: z.string().nullable(),
      viento: z.looseObject({ nombre: z.string().nullable(), velocidad: z.number().nullable() }),
      notas: z.looseObject({ familia: z.looseObject({ nota: z.number() }).nullable() }),
    }),
  ),
  franjas: z.object({
    familia: z
      .looseObject({ inicioLocal: z.string(), finLocal: z.string(), nota: z.number() })
      .nullable(),
    snorkel: z.unknown(),
    sol: z.unknown(),
    surf: z.unknown().nullable(),
  }),
});

describe.skipIf(!url)("GET /v1/playas/{id}/hoy contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let conSocorrista = 0;
  let sinDatos = 0;

  // A las 10:00 en España del 15 de julio
  const pedir = async (ruta: string, ahora = new Date("2026-07-15T08:00:00Z")) =>
    crearApp(conexion.db, { reloj: () => ahora }).request(ruta);
  const dia = async (id: number, ahora?: Date) => {
    const res = await pedir(`/v1/playas/${id.toString()}/hoy`, ahora);
    expect(res.status).toBe(200);
    return EsquemaRespuesta.parse(await res.json());
  };

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
    const playas = await db
      .insert(esquema.playas)
      .values(
        [1, 2].map((n) => ({
          nombre: `Playa ${n.toString()}`,
          slug: `playa-${n.toString()}`,
          municipioId: "30016",
          ubicacion: { x: -0.98, y: 37.6 },
          codigoCenso: `ES620M000000${n.toString()}`,
          puntoConsultaId: punto?.id ?? 0,
        })),
      )
      .returning({ id: esquema.playas.id });
    conSocorrista = playas[0]?.id ?? 0;
    sinDatos = playas[1]?.id ?? 0;
    await db
      .insert(esquema.playaServicios)
      .values({ playaId: conSocorrista, socorrista: true, fuentes: ["osm"] });

    // Dos emisiones: la antigua con levante, la nueva con poniente, que es la que vale
    for (const [emitidaEn, vientoDireccion] of [
      [new Date(INICIO_DIA - 6 * HORA_MS), 90],
      [new Date(INICIO_DIA - HORA_MS), 270],
    ] as const) {
      await db.insert(esquema.previsiones).values(
        Array.from({ length: 30 }, (_, i) => ({
          puntoId: punto?.id ?? 0,
          emitidaEn,
          hora: hora(i),
          vientoVelocidad: 12,
          vientoDireccion,
          temperaturaAire: 28,
          nubosidad: 10,
        })),
      );
    }

    // Condiciones y notas de 30 horas: el día entero y 6 del siguiente. Familia saca 90 de
    // 11:00 a 14:00 (hora de España) y 50 el resto; surf, siempre 0.
    for (const playaId of [conSocorrista, sinDatos]) {
      await db.insert(esquema.condiciones).values(
        Array.from({ length: 30 }, (_, i) => ({
          playaId,
          hora: hora(i),
          olaOrilla: 0.1,
          entradaViento: "tierra" as const,
          estadoAgua: "cristalina" as const,
          bandera: "verde" as const,
          emitidaEn: new Date(INICIO_DIA - HORA_MS),
        })),
      );
      await db.insert(esquema.notas).values(
        Array.from({ length: 30 }, (_, i) => [
          {
            playaId,
            perfil: "familia",
            hora: hora(i),
            nota: i >= 11 && i < 14 ? 90 : 50,
            razones: [{ tipo: "a_favor" as const, factor: "ola", texto: "Mar en calma" }],
            emitidaEn: new Date(INICIO_DIA - HORA_MS),
          },
          {
            playaId,
            perfil: "surf",
            hora: hora(i),
            nota: 0,
            emitidaEn: new Date(INICIO_DIA - HORA_MS),
          },
        ]).flat(),
      );
    }
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("da las 24 horas del día en hora de España, ni una más", async () => {
    const { fecha, horas } = await dia(conSocorrista);

    expect(fecha).toBe("2026-07-15");
    expect(horas).toHaveLength(24);
    expect(horas[0]).toMatchObject({ hora: "2026-07-14T22:00:00.000Z", horaLocal: "00:00" });
    expect(horas.at(-1)?.horaLocal).toBe("23:00");
  });

  it("pasada la medianoche en España ya es el día siguiente, aunque en UTC no", async () => {
    const { fecha, horas } = await dia(conSocorrista, new Date("2026-07-15T22:30:00Z"));

    expect(fecha).toBe("2026-07-16");
    expect(horas).toHaveLength(6);
  });

  it("el viento sale de la última emisión, con su nombre local", async () => {
    const { horas } = await dia(conSocorrista);

    expect(horas[0]?.viento).toMatchObject({ velocidad: 12, direccion: 270, nombre: "poniente" });
  });

  it("da las notas de cada hora con sus razones", async () => {
    const { horas } = await dia(conSocorrista);

    expect(horas[12]?.notas).toMatchObject({
      familia: { nota: 90, razones: [{ tipo: "a_favor", texto: "Mar en calma" }] },
      surf: { nota: 0, razones: [] },
      snorkel: null,
    });
  });

  it("la mejor franja de cada plan, en hora de España; sin nada que recomendar, nula", async () => {
    const { franjas, luz } = await dia(conSocorrista);

    expect(franjas.familia).toMatchObject({ inicioLocal: "11:00", finLocal: "14:00", nota: 90 });
    expect(franjas.surf).toBeNull();
    expect(luz?.ortoLocal).toMatch(/^06:/);
    expect(luz?.ocasoLocal).toMatch(/^21:/);
  });

  it("cada hora dice si es de día: a las 12:00 sí, a las 23:00 no", async () => {
    const { horas } = await dia(conSocorrista);

    expect(horas.find((h) => h.horaLocal === "12:00")?.deDia).toBe(true);
    expect(horas.find((h) => h.horaLocal === "23:00")?.deDia).toBe(false);
  });

  it("la bandera solo sale si la playa tiene socorrista", async () => {
    expect((await dia(conSocorrista)).horas[0]?.bandera).toBe("verde");
    expect((await dia(sinDatos)).horas[0]?.bandera).toBeNull();
  });

  it("una playa que no existe da 404, y un id que no es un número, 400", async () => {
    const res = await pedir("/v1/playas/999999/hoy");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No existe la playa 999999" });
    expect((await pedir("/v1/playas/la-azohia/hoy")).status).toBe(400);
  });
});
