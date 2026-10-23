import { esquema } from "@playa-hoy/db";
import { eq } from "drizzle-orm";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import datos from "../datos/municipios.json" with { type: "json" };
import { importarMunicipios, leerMunicipios } from "./municipios.ts";

describe("leerMunicipios", () => {
  it("lee los 8 municipios costeros del fichero y genera su slug", () => {
    const municipios = leerMunicipios(datos);

    expect(municipios).toHaveLength(8);
    expect(municipios).toContainEqual({
      id: "30036",
      nombre: "San Pedro del Pinatar",
      slug: "san-pedro-del-pinatar",
    });
  });

  it("rechaza un código que no es de la Región de Murcia", () => {
    const fichero = { fuente: "prueba", municipios: [{ id: "03014", nombre: "Alicante" }] };

    expect(() => leerMunicipios(fichero)).toThrow();
  });

  it("rechaza códigos repetidos", () => {
    const fichero = {
      fuente: "prueba",
      municipios: [
        { id: "30003", nombre: "Águilas" },
        { id: "30003", nombre: "Águilas otra vez" },
      ],
    };

    expect(() => leerMunicipios(fichero)).toThrow(/repetidos/);
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("importarMunicipios contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("crea los municipios la primera vez", async () => {
    expect(await importarMunicipios(conexion.db, leerMunicipios(datos))).toEqual({
      nuevos: 8,
      actualizados: 0,
    });
  });

  it("repetirlo no duplica: los actualiza", async () => {
    expect(await importarMunicipios(conexion.db, leerMunicipios(datos))).toEqual({
      nuevos: 0,
      actualizados: 8,
    });
    expect(await conexion.db.$count(esquema.municipios)).toBe(8);
  });

  it("actualiza el nombre y el slug si cambian en el fichero", async () => {
    await importarMunicipios(conexion.db, [{ id: "30041", nombre: "Unión, La", slug: "union-la" }]);

    const [fila] = await conexion.db
      .select()
      .from(esquema.municipios)
      .where(eq(esquema.municipios.id, "30041"));
    expect(fila).toEqual({ id: "30041", nombre: "Unión, La", slug: "union-la" });
  });
});
