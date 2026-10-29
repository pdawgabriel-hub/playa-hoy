import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { crearApp } from "../app.ts";

const url = process.env.DATABASE_URL ?? "";

const playa = (
  n: number,
  nombre: string,
  municipioId: string,
  zonaId: number | null,
  laguna = false,
) => ({
  nombre,
  slug: `playa-${n.toString()}`,
  municipioId,
  zonaId,
  ubicacion: { x: -(80 + n) / 100, y: 37.7 },
  codigoCenso: `ES620M000000${n.toString()}`,
  laguna,
  mira: 90,
});

const EsquemaLista = z.object({
  datos: z.array(z.looseObject({ nombre: z.string() })),
});

describe.skipIf(!url)("GET /v1/playas contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let app: ReturnType<typeof crearApp>;

  const nombres = async (consulta = "") => {
    const res = await app.request(`/v1/playas${consulta}`);
    expect(res.status).toBe(200);
    return EsquemaLista.parse(await res.json()).datos.map((p) => p.nombre);
  };

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    app = crearApp(conexion.db);
    const { db } = conexion;
    await db.insert(esquema.municipios).values([
      { id: "30016", nombre: "Cartagena", slug: "cartagena" },
      { id: "30902", nombre: "Los Alcázares", slug: "los-alcazares" },
    ]);
    const [marMenor] = await db
      .insert(esquema.zonas)
      .values({ nombre: "Mar Menor", slug: "mar-menor" })
      .returning({ id: esquema.zonas.id });
    const zonaMarMenor = marMenor?.id ?? null;
    const [narejos, urrutias, portus] = await db
      .insert(esquema.playas)
      .values([
        playa(1, "Los Narejos", "30902", zonaMarMenor, true),
        playa(2, "Los Urrutias", "30016", zonaMarMenor, true),
        playa(3, "El Portús", "30016", null),
      ])
      .returning({ id: esquema.playas.id });
    await db.insert(esquema.playaServicios).values([
      // Los Narejos: socorrista y no admite perros
      {
        playaId: narejos?.id ?? 0,
        socorrista: true,
        perros: false,
        suelo: "arena",
        fuentes: ["osm"],
      },
      // Los Urrutias: sin socorrista; de los perros no se sabe
      { playaId: urrutias?.id ?? 0, socorrista: false, ocupacion: "alta", fuentes: ["itrem"] },
      // El Portús: sin datos de servicios
    ]);
    await db.insert(esquema.calidadAgua).values([
      { playaId: portus?.id ?? 0, temporada: 2024, calificacion: "buena" },
      { playaId: portus?.id ?? 0, temporada: 2025, calificacion: "excelente" },
    ]);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("sin filtros da todas, por orden alfabético en español", async () => {
    expect(await nombres()).toEqual(["El Portús", "Los Narejos", "Los Urrutias"]);
  });

  it("filtra por zona y por municipio, con su slug", async () => {
    expect(await nombres("?zona=mar-menor")).toEqual(["Los Narejos", "Los Urrutias"]);
    expect(await nombres("?municipio=cartagena")).toEqual(["El Portús", "Los Urrutias"]);
    expect(await nombres("?zona=mar-menor&municipio=cartagena")).toEqual(["Los Urrutias"]);
  });

  it("una zona o un municipio que no existen dan 404, no una lista vacía", async () => {
    const res = await app.request("/v1/playas?zona=atlantida");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No existe la zona atlantida" });
    expect((await app.request("/v1/playas?municipio=madrid")).status).toBe(404);
  });

  it("filtra por servicios con true y false", async () => {
    expect(await nombres("?socorrista=true")).toEqual(["Los Narejos"]);
    expect(await nombres("?socorrista=false")).toEqual(["Los Urrutias"]);
  });

  it("una playa de la que no se sabe un servicio no sale con ningún filtro de ese servicio", async () => {
    // De los perros solo se sabe en Los Narejos (no)
    expect(await nombres("?perros=false")).toEqual(["Los Narejos"]);
    expect(await nombres("?perros=true")).toEqual([]);
  });

  it("filtra por laguna", async () => {
    expect(await nombres("?laguna=false")).toEqual(["El Portús"]);
  });

  it("un filtro con un valor que no es true ni false da 400", async () => {
    expect((await app.request("/v1/playas?socorrista=si")).status).toBe(400);
  });

  it("da el resumen de cada playa, con los servicios desconocidos en nulo y la última calidad del agua", async () => {
    const res = await app.request("/v1/playas?municipio=cartagena");
    const { datos } = z.object({ datos: z.array(z.unknown()) }).parse(await res.json());

    expect(datos[0]).toMatchObject({
      nombre: "El Portús",
      municipio: { id: "30016", nombre: "Cartagena", slug: "cartagena" },
      zona: null,
      ubicacion: { lat: 37.7, lon: -0.83 },
      laguna: false,
      mira: 90,
      servicios: { socorrista: null, perros: null, suelo: null, ocupacion: null },
      calidadAgua: { temporada: 2025, calificacion: "excelente" },
    });
    expect(datos[1]).toMatchObject({
      nombre: "Los Urrutias",
      zona: { nombre: "Mar Menor", slug: "mar-menor" },
      servicios: { socorrista: false, ocupacion: "alta" },
      calidadAgua: null,
    });
  });
});
