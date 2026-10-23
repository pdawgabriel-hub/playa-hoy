import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import excepcionesReales from "../datos/excepciones-costa.json" with { type: "json" };
import { calcularGeografiaPlayas, geometriaMarMenor, leerExcepciones } from "./geografia-playas.ts";

// Geografía sintética en metros alrededor de un origen frente a Cartagena
const ORIGEN = { lon: -0.9, lat: 37.6 };
const M_LAT = 111_195;
const M_LON = M_LAT * Math.cos((ORIGEN.lat * Math.PI) / 180);
const punto = (x: number, y: number) => ({ x: ORIGEN.lon + x / M_LON, y: ORIGEN.lat + y / M_LAT });

// Costa recta de sur a norte en x = 0: el mar queda al este (a la derecha)
const COSTA_ABIERTA = [punto(0, -5000), punto(0, 5000)];
// Laguna cuadrada de 4 km, detrás de la costa abierta (en x = -40..-36 km) para no taparle el
// mar. Se recorre en sentido horario: el agua queda dentro, a la derecha.
const LAGUNA = [
  punto(-40_000, -2000),
  punto(-40_000, 2000),
  punto(-36_000, 2000),
  punto(-36_000, -2000),
  punto(-40_000, -2000),
];

const PLAYAS = {
  abierta: { codigo: "ES620M0000001", ubicacion: punto(-20, 0) },
  laguna: { codigo: "ES620M0000002", ubicacion: punto(-40_020, 0) },
  excepcion: { codigo: "ES620M0000003", ubicacion: punto(-20, 1000) },
  lejos: { codigo: "ES620M0000004", ubicacion: punto(-3000, 0) },
};

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("calcularGeografiaPlayas contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let resultado: Awaited<ReturnType<typeof calcularGeografiaPlayas>>;

  const leer = async (codigo: string) => {
    const [fila] = await conexion.db
      .select({
        mira: esquema.playas.mira,
        abrigo: esquema.playas.abrigo,
        laguna: esquema.playas.laguna,
      })
      .from(esquema.playas)
      .where(eq(esquema.playas.codigoCenso, codigo));
    return fila;
  };

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const { db } = conexion;
    await db
      .insert(esquema.municipios)
      .values({ id: "30016", nombre: "Cartagena", slug: "cartagena" });
    await db.insert(esquema.playas).values(
      Object.entries(PLAYAS).map(([slug, p]) => ({
        nombre: slug,
        slug,
        municipioId: "30016",
        ubicacion: p.ubicacion,
        codigoCenso: p.codigo,
      })),
    );
    await db.insert(esquema.costa).values([
      { id: "way/1", linea: COSTA_ABIERTA },
      { id: "way/2", linea: LAGUNA },
    ]);

    const marMenor = geometriaMarMenor([
      {
        type: "relation",
        id: 1,
        members: [
          { type: "way", role: "outer", geometry: LAGUNA.map(({ x, y }) => ({ lon: x, lat: y })) },
        ],
      },
    ]);
    const excepciones = {
      laguna: [{ codigo: PLAYAS.excepcion.codigo, laguna: true, motivo: "prueba" }],
    };
    resultado = await calcularGeografiaPlayas(db, marMenor, excepciones);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("playa en costa abierta: mira al mar y no tiene abrigo", async () => {
    expect(await leer(PLAYAS.abierta.codigo)).toEqual({ mira: 90, abrigo: 0, laguna: false });
  });

  it("playa en la laguna: es de laguna y está muy abrigada", async () => {
    const laguna = await leer(PLAYAS.laguna.codigo);

    expect(laguna).toMatchObject({ mira: 90, laguna: true });
    // 4 km de agua de frente sobre los 30 km de mar abierto
    expect(laguna?.abrigo).toBeGreaterThan(0.8);
  });

  it("aplica las excepciones del fichero", async () => {
    expect((await leer(PLAYAS.excepcion.codigo))?.laguna).toBe(true);
  });

  it("sin costa cerca no inventa orientación ni abrigo", async () => {
    expect(await leer(PLAYAS.lejos.codigo)).toEqual({ mira: null, abrigo: null, laguna: false });
    expect(resultado.sinOrientacion).toEqual(["lejos"]);
  });

  it("cuenta las playas de laguna", () => {
    expect(resultado).toMatchObject({ playas: 4, laguna: 2 });
  });
});

describe("geometriaMarMenor", () => {
  it("falla si OSM no devuelve el polígono", () => {
    expect(() => geometriaMarMenor([])).toThrow(/Mar Menor/);
  });
});

describe("leerExcepciones con el fichero real", () => {
  it("cada excepción tiene su motivo", () => {
    expect(leerExcepciones(excepcionesReales).laguna).toEqual([
      expect.objectContaining({ codigo: "ES620M0161609", laguna: true }),
    ]);
  });
});
