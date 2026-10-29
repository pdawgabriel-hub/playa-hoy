import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { crearApp } from "../app.ts";

const url = process.env.DATABASE_URL ?? "";
const HORA = new Date("2026-07-15T10:00:00Z");
// Origen: Cartagena. Un grado de latitud son unos 111 km.
const ORIGEN = { lat: 37.6, lon: -0.98 };
const PLAYAS = [
  { nombre: "A 10 km", lat: 37.6 + 10 / 111.2, nota: 60 },
  { nombre: "A 1 km", lat: 37.6 + 1 / 111.2, nota: 90 },
  { nombre: "A 80 km", lat: 37.6 + 80 / 111.2, nota: null },
];

const EsquemaRespuesta = z.object({
  origen: z.object({ lat: z.number(), lon: z.number() }),
  radioKm: z.number(),
  plan: z.string().nullable(),
  horaLocal: z.string().nullable(),
  playas: z.array(
    z.object({
      playa: z.looseObject({ nombre: z.string() }),
      distanciaM: z.number(),
      nota: z.looseObject({ nota: z.number() }).nullable(),
    }),
  ),
});

describe.skipIf(!url)("GET /v1/playas/cerca contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;

  const pedir = (consulta: string) =>
    crearApp(conexion.db, { reloj: () => new Date("2026-07-15T10:20:00Z") }).request(
      `/v1/playas/cerca?${consulta}`,
    );
  const cerca = async (consulta: string) => {
    const res = await pedir(consulta);
    expect(res.status).toBe(200);
    return EsquemaRespuesta.parse(await res.json());
  };
  const enOrigen = `lat=${ORIGEN.lat.toString()}&lon=${ORIGEN.lon.toString()}`;

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const { db } = conexion;
    await db
      .insert(esquema.municipios)
      .values({ id: "30016", nombre: "Cartagena", slug: "cartagena" });
    const filas = await db
      .insert(esquema.playas)
      .values(
        PLAYAS.map((p, i) => ({
          nombre: p.nombre,
          slug: `playa-${i.toString()}`,
          municipioId: "30016",
          ubicacion: { x: ORIGEN.lon, y: p.lat },
          codigoCenso: `ES620M000000${i.toString()}`,
        })),
      )
      .returning({ id: esquema.playas.id });
    await db.insert(esquema.notas).values(
      PLAYAS.flatMap((p, i) =>
        p.nota === null
          ? []
          : [
              {
                playaId: filas[i]?.id ?? 0,
                perfil: "familia",
                hora: HORA,
                nota: p.nota,
                emitidaEn: HORA,
              },
            ],
      ),
    );
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("ordena de la más cercana a la más lejana, con la distancia en metros", async () => {
    const { playas } = await cerca(enOrigen);

    expect(playas.map((p) => p.playa.nombre)).toEqual(["A 1 km", "A 10 km"]);
    expect(playas[0]?.distanciaM).toBeGreaterThan(990);
    expect(playas[0]?.distanciaM).toBeLessThan(1010);
    expect(playas[1]?.distanciaM).toBeGreaterThan(9900);
    expect(playas[1]?.distanciaM).toBeLessThan(10_100);
  });

  it("por defecto busca en 50 km; con un radio mayor llega más lejos", async () => {
    expect((await cerca(enOrigen)).radioKm).toBe(50);
    expect((await cerca(`${enOrigen}&radio=100`)).playas.map((p) => p.playa.nombre)).toEqual([
      "A 1 km",
      "A 10 km",
      "A 80 km",
    ]);
    expect((await cerca(`${enOrigen}&radio=5`)).playas).toHaveLength(1);
  });

  it("el límite se queda con las más cercanas", async () => {
    expect(
      (await cerca(`${enOrigen}&radio=100&limite=1`)).playas.map((p) => p.playa.nombre),
    ).toEqual(["A 1 km"]);
  });

  it("sin plan no hay notas; con plan, la de la hora en curso", async () => {
    const sinPlan = await cerca(enOrigen);
    expect(sinPlan).toMatchObject({ plan: null, horaLocal: null });
    expect(sinPlan.playas.every((p) => p.nota === null)).toBe(true);

    const conPlan = await cerca(`${enOrigen}&radio=100&plan=familia`);
    expect(conPlan).toMatchObject({ plan: "familia", horaLocal: "12:00" });
    expect(conPlan.playas.map((p) => p.nota?.nota ?? null)).toEqual([90, 60, null]);
  });

  it("sin coordenadas, con coordenadas imposibles o un radio fuera de rango da 400", async () => {
    expect((await pedir("lat=37.6")).status).toBe(400);
    expect((await pedir("lat=95&lon=-0.98")).status).toBe(400);
    expect((await pedir(`${enOrigen}&radio=500`)).status).toBe(400);
    expect((await pedir(`${enOrigen}&plan=pesca`)).status).toBe(400);
  });

  it("no choca con /v1/playas/{id}/hoy: 'cerca' no se toma por un id", async () => {
    expect((await pedir(enOrigen)).status).toBe(200);
  });
});
