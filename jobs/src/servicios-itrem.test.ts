import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import censo from "../datos/censo-2025-murcia.json" with { type: "json" };
import correcciones from "../datos/correcciones-censo.json" with { type: "json" };
import correspondencias from "../datos/correspondencias-itrem.json" with { type: "json" };
import itrem from "../datos/itrem-playas.json" with { type: "json" };
import datosMunicipios from "../datos/municipios.json" with { type: "json" };
import { importarMunicipios, leerMunicipios } from "./municipios.ts";
import { importarPlayasCenso, prepararPlayasCenso } from "./playas-censo.ts";
import { importarServiciosItrem, prepararServiciosItrem } from "./servicios-itrem.ts";

// Ids ficticios: el número de orden de cada playa del censo
const idsFicticios = new Map(censo.zonas.map((z, i) => [z.codigo, i + 1]));
const idBolnuevo = idsFicticios.get("ES620M0261636") ?? 0;

describe("prepararServiciosItrem con los datos reales", () => {
  const servicios = prepararServiciosItrem(itrem, correspondencias, idsFicticios);

  it("prepara los servicios de las 75 playas con correspondencia", () => {
    expect(servicios).toHaveLength(75);
  });

  it("traduce los valores de ITREM", () => {
    // ITREM: ARENA GRUESA Y DORADA, ocupación Medio, accesible Sí, nudista No
    expect(servicios.find((s) => s.playaId === idBolnuevo)).toEqual({
      playaId: idBolnuevo,
      accesible: true,
      nudista: false,
      suelo: "arena",
      ocupacion: "media",
    });
  });

  it("falla si la tabla apunta a una playa que no existe", () => {
    const tabla = { correspondencias: [{ codigoCenso: "ES620M0000000", codigoItrem: "646" }] };

    expect(() => prepararServiciosItrem(itrem, tabla, idsFicticios)).toThrow(/ES620M0000000/);
  });

  it("falla si la tabla apunta a un código ITREM que no existe", () => {
    const tabla = { correspondencias: [{ codigoCenso: "ES620M0261636", codigoItrem: "99999" }] };

    expect(() => prepararServiciosItrem(itrem, tabla, idsFicticios)).toThrow(/99999/);
  });
});

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("importarServiciosItrem contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let servicios: ReturnType<typeof prepararServiciosItrem>;
  let bolnuevo: number;

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const municipios = leerMunicipios(datosMunicipios);
    await importarMunicipios(conexion.db, municipios);
    const slugs = new Map(municipios.map((m) => [m.id, m.slug]));
    await importarPlayasCenso(conexion.db, prepararPlayasCenso(censo, correcciones, slugs).playas);

    const playas = await conexion.db
      .select({ id: esquema.playas.id, codigo: esquema.playas.codigoCenso })
      .from(esquema.playas);
    const ids = new Map(playas.map((p) => [p.codigo ?? "", p.id]));
    servicios = prepararServiciosItrem(itrem, correspondencias, ids);
    bolnuevo = ids.get("ES620M0261636") ?? 0;
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  const leerBolnuevo = async () => {
    const [fila] = await conexion.db
      .select()
      .from(esquema.playaServicios)
      .where(eq(esquema.playaServicios.playaId, bolnuevo));
    return fila;
  };

  it("crea los servicios de las 75 playas", async () => {
    expect(await importarServiciosItrem(conexion.db, servicios)).toEqual({
      nuevas: 75,
      actualizadas: 0,
    });
    expect(await leerBolnuevo()).toMatchObject({
      accesible: true,
      suelo: "arena",
      ocupacion: "media",
      socorrista: null,
      fuentes: ["itrem"],
    });
  });

  it("reimportar no pisa los datos de OSM y combina las fuentes", async () => {
    await conexion.db
      .update(esquema.playaServicios)
      .set({ socorrista: true, fuentes: ["osm", "itrem"] })
      .where(eq(esquema.playaServicios.playaId, bolnuevo));

    expect(await importarServiciosItrem(conexion.db, servicios)).toEqual({
      nuevas: 0,
      actualizadas: 75,
    });
    expect(await leerBolnuevo()).toMatchObject({
      socorrista: true,
      accesible: true,
      fuentes: ["osm", "itrem"],
    });
  });
});
