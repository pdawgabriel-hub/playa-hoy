import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { crearApp } from "../app.ts";

const url = process.env.DATABASE_URL ?? "";

// Una playa del censo de prueba en un municipio y, si se indica, una zona
const playa = (n: number, municipioId: string, zonaId: number | undefined) => ({
  nombre: `Playa ${n.toString()}`,
  slug: `playa-${n.toString()}`,
  municipioId,
  zonaId: zonaId ?? null,
  ubicacion: { x: -0.75, y: 37.7 },
  codigoCenso: `ES620M000000${n.toString()}`,
});

describe.skipIf(!url)("catálogo contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let app: ReturnType<typeof crearApp>;

  const pedir = async (ruta: string) => {
    const res = await app.request(ruta);
    return { status: res.status, cuerpo: await res.json() };
  };

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    app = crearApp(conexion.db);
    const { db } = conexion;
    await db.insert(esquema.municipios).values([
      { id: "30016", nombre: "Cartagena", slug: "cartagena" },
      { id: "30003", nombre: "Águilas", slug: "aguilas" },
      { id: "30035", nombre: "San Javier", slug: "san-javier" },
      // Sin playas
      { id: "30041", nombre: "La Unión", slug: "la-union" },
    ]);
    const [laManga, marMenor] = await db
      .insert(esquema.zonas)
      .values([
        { nombre: "La Manga", slug: "la-manga", descripcion: "Entre dos mares" },
        { nombre: "Mar Menor", slug: "mar-menor", descripcion: null },
      ])
      .returning({ id: esquema.zonas.id });
    // La Manga tiene playas de Cartagena y de San Javier
    await db
      .insert(esquema.playas)
      .values([
        playa(1, "30016", laManga?.id),
        playa(2, "30035", laManga?.id),
        playa(3, "30035", laManga?.id),
        playa(4, "30035", marMenor?.id),
        playa(5, "30003", undefined),
      ]);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  describe("GET /v1/municipios", () => {
    it("da cada municipio con su número de playas, por orden alfabético en español", async () => {
      expect(await pedir("/v1/municipios")).toEqual({
        status: 200,
        cuerpo: {
          datos: [
            { id: "30003", nombre: "Águilas", slug: "aguilas", playas: 1 },
            { id: "30016", nombre: "Cartagena", slug: "cartagena", playas: 1 },
            { id: "30041", nombre: "La Unión", slug: "la-union", playas: 0 },
            { id: "30035", nombre: "San Javier", slug: "san-javier", playas: 3 },
          ],
        },
      });
    });
  });

  describe("GET /v1/zonas", () => {
    it("da cada zona con su número de playas y sus municipios", async () => {
      const { status, cuerpo } = await pedir("/v1/zonas");

      expect(status).toBe(200);
      expect(cuerpo).toMatchObject({
        datos: [
          {
            nombre: "La Manga",
            slug: "la-manga",
            descripcion: "Entre dos mares",
            playas: 3,
            municipios: [
              { id: "30016", nombre: "Cartagena" },
              { id: "30035", nombre: "San Javier" },
            ],
          },
          {
            nombre: "Mar Menor",
            descripcion: null,
            playas: 1,
            municipios: [{ id: "30035", nombre: "San Javier" }],
          },
        ],
      });
    });
  });

  it("las dos rutas aparecen en la especificación OpenAPI", async () => {
    const { cuerpo } = await pedir("/openapi.json");

    expect(cuerpo).toMatchObject({
      paths: { "/v1/municipios": { get: {} }, "/v1/zonas": { get: {} } },
      components: { schemas: { Municipio: {}, Zona: {} } },
    });
  });
});
