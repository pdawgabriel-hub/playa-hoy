import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { crearApp } from "../app.ts";

const url = process.env.DATABASE_URL ?? "";
// Las 12:00 del 15 de julio en España
const HORA = new Date("2026-07-15T10:00:00Z");

const EsquemaRanking = z.object({
  zona: z.object({ nombre: z.string() }).nullable(),
  plan: z.string(),
  hora: z.string(),
  horaLocal: z.string(),
  playas: z.array(
    z.object({
      posicion: z.number(),
      playa: z.looseObject({ nombre: z.string() }),
      nota: z.number(),
      razones: z.array(z.unknown()),
      olaOrilla: z.number().nullable(),
      estadoAgua: z.string().nullable(),
      bandera: z.string().nullable(),
    }),
  ),
});

describe.skipIf(!url)("ranking contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let marMenor = 0;

  // Por defecto, a las 12:20 en España
  const pedir = (ruta: string) =>
    crearApp(conexion.db, { reloj: () => new Date("2026-07-15T10:20:00Z") }).request(ruta);
  const ranking = async (ruta: string) => {
    const res = await pedir(ruta);
    expect(res.status).toBe(200);
    return EsquemaRanking.parse(await res.json());
  };
  const nombres = async (ruta: string) =>
    (await ranking(ruta)).playas.map(
      (p) => `${p.posicion.toString()}. ${p.playa.nombre} ${p.nota.toString()}`,
    );

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const { db } = conexion;
    await db
      .insert(esquema.municipios)
      .values({ id: "30016", nombre: "Cartagena", slug: "cartagena" });
    const [zonaMarMenor, zonaManga] = await db
      .insert(esquema.zonas)
      .values([
        { nombre: "Mar Menor", slug: "mar-menor" },
        { nombre: "La Manga", slug: "la-manga" },
      ])
      .returning({ id: esquema.zonas.id });
    marMenor = zonaMarMenor?.id ?? 0;

    // [nombre, zona, nota de familia]: Los Urrutias y Los Nietos empatan a 80
    const datos = [
      ["Los Urrutias", marMenor, 80],
      ["Los Nietos", marMenor, 80],
      ["Playa Honda", marMenor, 95],
      ["Galúa", zonaManga?.id ?? 0, 40],
      ["El Portús", null, 70],
    ] as const;
    const playas = await db
      .insert(esquema.playas)
      .values(
        datos.map(([nombre, zonaId], i) => ({
          nombre,
          slug: `playa-${i.toString()}`,
          municipioId: "30016",
          zonaId,
          ubicacion: { x: -0.8, y: 37.6 },
          codigoCenso: `ES620M000000${i.toString()}`,
        })),
      )
      .returning({ id: esquema.playas.id });
    const ids = playas.map((p) => p.id);
    // Solo Playa Honda tiene socorrista
    await db
      .insert(esquema.playaServicios)
      .values({ playaId: ids[2] ?? 0, socorrista: true, fuentes: ["osm"] });

    await db.insert(esquema.notas).values(
      datos.map(([, , nota], i) => ({
        playaId: ids[i] ?? 0,
        perfil: "familia",
        hora: HORA,
        nota,
        razones: [{ tipo: "a_favor" as const, factor: "ola", texto: "Mar en calma" }],
        emitidaEn: HORA,
      })),
    );
    await db.insert(esquema.condiciones).values(
      ids.map((playaId) => ({
        playaId,
        hora: HORA,
        olaOrilla: 0.1,
        estadoAgua: "cristalina" as const,
        bandera: "verde" as const,
        emitidaEn: HORA,
      })),
    );
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("ordena las playas de una zona de mejor a peor nota; a igual nota, por nombre", async () => {
    expect(await nombres(`/v1/zonas/${marMenor.toString()}/ranking?plan=familia`)).toEqual([
      "1. Playa Honda 95",
      "2. Los Nietos 80",
      "3. Los Urrutias 80",
    ]);
  });

  it("toda la costa incluye todas las zonas y las playas sin zona", async () => {
    const { zona, playas } = await ranking("/v1/ranking?plan=familia");

    expect(zona).toBeNull();
    expect(playas.map((p) => p.playa.nombre)).toEqual([
      "Playa Honda",
      "Los Nietos",
      "Los Urrutias",
      "El Portús",
      "Galúa",
    ]);
  });

  it("el límite corta después de ordenar", async () => {
    expect(await nombres("/v1/ranking?plan=familia&limite=2")).toEqual([
      "1. Playa Honda 95",
      "2. Los Nietos 80",
    ]);
  });

  it("sin hora, la hora en curso; con hora, en punto y con su zona horaria", async () => {
    expect(await ranking("/v1/ranking?plan=familia")).toMatchObject({
      hora: "2026-07-15T10:00:00.000Z",
      horaLocal: "12:00",
    });
    const conHora = await ranking(
      `/v1/ranking?plan=familia&hora=${encodeURIComponent("2026-07-15T12:30:00+02:00")}`,
    );
    expect(conHora.hora).toBe("2026-07-15T10:00:00.000Z");
    expect(conHora.playas).toHaveLength(5);
  });

  it("a una hora sin notas, o de un plan sin notas, la lista va vacía", async () => {
    expect((await ranking("/v1/ranking?plan=familia&hora=2026-07-20T10:00:00Z")).playas).toEqual(
      [],
    );
    expect((await ranking("/v1/ranking?plan=surf")).playas).toEqual([]);
  });

  it("cada puesto lleva sus razones y condiciones; la bandera, solo con socorrista", async () => {
    const { playas } = await ranking(`/v1/zonas/${marMenor.toString()}/ranking?plan=familia`);

    expect(playas[0]).toMatchObject({
      playa: { nombre: "Playa Honda", zona: { nombre: "Mar Menor" } },
      razones: [{ texto: "Mar en calma" }],
      olaOrilla: 0.1,
      estadoAgua: "cristalina",
      bandera: "verde",
    });
    expect(playas[1]?.bandera).toBeNull();
  });

  it("una zona que no existe da 404; sin plan, con un plan desconocido o una hora mal escrita, 400", async () => {
    expect((await pedir("/v1/zonas/999999/ranking?plan=familia")).status).toBe(404);
    expect((await pedir("/v1/ranking")).status).toBe(400);
    expect((await pedir("/v1/ranking?plan=pesca")).status).toBe(400);
    expect((await pedir("/v1/ranking?plan=sol&hora=mediodia")).status).toBe(400);
    expect((await pedir("/v1/ranking?plan=sol&limite=0")).status).toBe(400);
  });
});
