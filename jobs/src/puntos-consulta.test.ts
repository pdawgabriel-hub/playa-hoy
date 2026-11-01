import { esquema, asc } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type PlayaConCeldas,
  agruparPorCeldas,
  importarPuntosConsulta,
} from "./puntos-consulta.ts";

const celda = (lat: number, lon: number) => ({ lat, lon });
const MARINA_A = celda(37.708336, -0.70832825);
const MARINA_B = celda(37.625, -0.87498474);
const VIENTO = celda(37.72, -0.71);
const TIERRA = celda(37.64, -0.77);

const playa = (id: number, marina = MARINA_A): PlayaConCeldas => ({
  id,
  ubicacion: celda(37.7 + id / 1000, -0.74),
  celdaMarina: marina,
  celdaViento: VIENTO,
  celdaTiempo: TIERRA,
});

describe("agruparPorCeldas", () => {
  it("junta las playas que caen en las mismas tres celdas", () => {
    const grupos = agruparPorCeldas([playa(3), playa(1), playa(2, MARINA_B)]);

    expect(grupos.map((g) => g.playas)).toEqual([[1, 3], [2]]);
  });

  it("el punto del grupo es la ubicación de su playa de menor id", () => {
    const [grupo] = agruparPorCeldas([playa(3), playa(1)]);

    expect(grupo?.ubicacion).toEqual(playa(1).ubicacion);
  });

  it("basta con que cambie una celda para que sean grupos distintos", () => {
    const otraTierra = { ...playa(2), celdaTiempo: celda(37.75, -0.88) };

    expect(agruparPorCeldas([playa(1), otraTierra])).toHaveLength(2);
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("importarPuntosConsulta contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let ids: number[] = [];

  const puntoDeCadaPlaya = async () =>
    (
      await conexion.db
        .select({ punto: esquema.playas.puntoConsultaId })
        .from(esquema.playas)
        .orderBy(asc(esquema.playas.id))
    ).map((p) => p.punto);

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    await conexion.db
      .insert(esquema.municipios)
      .values({ id: "30016", nombre: "Cartagena", slug: "cartagena" });
    const filas = await conexion.db
      .insert(esquema.playas)
      .values(
        [1, 2, 3].map((n) => ({
          nombre: `Playa ${n}`,
          slug: `playa-${n}`,
          municipioId: "30016",
          ubicacion: { x: -0.74, y: 37.7 + n / 1000 },
          codigoCenso: `ES620M000000${n}`,
        })),
      )
      .returning({ id: esquema.playas.id });
    ids = filas.map((f) => f.id);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("crea un punto por grupo y enlaza cada playa con el suyo", async () => {
    const [a = 0, b = 0, c = 0] = ids;
    const grupos = agruparPorCeldas([playa(a), playa(b), playa(c, MARINA_B)]);

    expect(await importarPuntosConsulta(conexion.db, grupos)).toEqual({
      puntos: 2,
      playas: 3,
      borrados: 0,
    });
    const [p1, p2, p3] = await puntoDeCadaPlaya();
    expect(p1).toBe(p2);
    expect(p3).not.toBe(p1);
  });

  it("repetirlo no duplica puntos", async () => {
    const [a = 0, b = 0, c = 0] = ids;
    await importarPuntosConsulta(
      conexion.db,
      agruparPorCeldas([playa(a), playa(b), playa(c, MARINA_B)]),
    );

    expect(await conexion.db.$count(esquema.puntosConsulta)).toBe(2);
  });

  it("un punto que se queda sin playas y sin previsiones se borra", async () => {
    const [a = 0, b = 0, c = 0] = ids;
    const otraTierra = { ...playa(b), celdaTiempo: celda(37.75, -0.88) };
    // La playa 2 pasa a su propio punto y luego vuelve: ese punto se queda vacío
    await importarPuntosConsulta(
      conexion.db,
      agruparPorCeldas([playa(a), otraTierra, playa(c, MARINA_B)]),
    );
    expect(await conexion.db.$count(esquema.puntosConsulta)).toBe(3);

    const resultado = await importarPuntosConsulta(
      conexion.db,
      agruparPorCeldas([playa(a), playa(b), playa(c, MARINA_B)]),
    );

    expect(resultado.borrados).toBe(1);
    expect(await conexion.db.$count(esquema.puntosConsulta)).toBe(2);
  });

  it("un punto que se queda sin playas pero tiene previsiones se conserva", async () => {
    const [a = 0, b = 0, c = 0] = ids;
    const [, , antes] = await puntoDeCadaPlaya();
    // El punto de la playa 3 tiene una previsión guardada
    await conexion.db.insert(esquema.previsiones).values({
      puntoId: antes ?? 0,
      emitidaEn: new Date("2026-10-23T06:00Z"),
      hora: new Date("2026-10-24T12:00Z"),
      vientoVelocidad: 20,
    });

    // Ahora las tres playas caen en la misma celda: el punto de la playa 3 se queda sin playas
    const resultado = await importarPuntosConsulta(
      conexion.db,
      agruparPorCeldas([playa(a), playa(b), playa(c)]),
    );

    expect(resultado).toEqual({ puntos: 1, playas: 3, borrados: 0 });
    expect(await conexion.db.$count(esquema.puntosConsulta)).toBe(2);
    expect(await conexion.db.$count(esquema.previsiones)).toBe(1);
  });
});
