import { esquema, asc } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import censo from "../datos/censo-2025-murcia.json" with { type: "json" };
import correspondencias from "../datos/correspondencias-aemet.json" with { type: "json" };
import type { PrediccionPlayaAemet } from "./aemet/playas.ts";
import {
  filasPrevisionAemet,
  guardarPrevisionesAemet,
  importarCodigosAemet,
  leerCorrespondenciasAemet,
} from "./playas-aemet.ts";

describe("tabla de correspondencias con AEMET", () => {
  const tabla = leerCorrespondenciasAemet(correspondencias);

  it("todas apuntan a zonas del censo", () => {
    const codigos = new Set(censo.zonas.map((z) => z.codigo));

    expect(tabla.filter((c) => !codigos.has(c.codigoCenso))).toEqual([]);
  });

  it("entre emparejadas y sin pareja están las 30 playas de AEMET en Murcia", () => {
    expect(tabla.length + Object.keys(correspondencias.sinCorrespondencia).length).toBe(30);
  });

  it("rechaza una playa de AEMET emparejada con dos del censo", () => {
    const repetida = {
      correspondencias: [
        { codigoCenso: "ES620M0000001", codigoAemet: "3000301" },
        { codigoCenso: "ES620M0000002", codigoAemet: "3000301" },
      ],
    };

    expect(() => leerCorrespondenciasAemet(repetida)).toThrow(/codigoAemet repetido/);
  });
});

const prediccion = (elaborado: string, temperaturaAgua: number): PrediccionPlayaAemet => {
  const dia = {
    temperaturaAgua,
    temperaturaMaxima: 25,
    uvMaximo: 4,
    cielo: { manana: "despejado", tarde: "despejado" },
    viento: { manana: "flojo", tarde: "flojo" },
    oleaje: { manana: "débil", tarde: "débil" },
  };
  return {
    nombre: "Manzanares",
    elaborado: new Date(elaborado),
    dias: [
      { fecha: "2026-10-23", ...dia },
      { fecha: "2026-10-24", ...dia },
    ],
  };
};

const url = process.env.DATABASE_URL ?? "";

describe.skipIf(!url)("playas de AEMET contra PostgreSQL real", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let ids: number[] = [];

  const codigos = async () =>
    (
      await conexion.db
        .select({ codigo: esquema.playas.codigoAemet })
        .from(esquema.playas)
        .orderBy(asc(esquema.playas.id))
    ).map((p) => p.codigo);

  const aguaGuardada = async () =>
    (
      await conexion.db
        .select({ agua: esquema.previsionesAemet.temperaturaAgua })
        .from(esquema.previsionesAemet)
        .orderBy(asc(esquema.previsionesAemet.fecha))
    ).map((p) => p.agua);

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    await conexion.db
      .insert(esquema.municipios)
      .values({ id: "30902", nombre: "Los Alcázares", slug: "los-alcazares" });
    const filas = await conexion.db
      .insert(esquema.playas)
      .values(
        [1, 2].map((n) => ({
          nombre: `Playa ${n.toString()}`,
          slug: `playa-${n.toString()}`,
          municipioId: "30902",
          ubicacion: { x: -0.84, y: 37.74 + n / 1000 },
          codigoCenso: `ES620M000000${n.toString()}`,
        })),
      )
      .returning({ id: esquema.playas.id });
    ids = filas.map((f) => f.id);
  });

  beforeEach(async () => {
    await conexion.db.delete(esquema.previsionesAemet);
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("pone el código de AEMET a cada playa de la tabla", async () => {
    await importarCodigosAemet(conexion.db, [
      { codigoCenso: "ES620M0000001", codigoAemet: "3090206" },
    ]);

    expect(await codigos()).toEqual(["3090206", null]);
  });

  it("un código puede pasar de una playa a otra sin chocar con la restricción de único", async () => {
    await importarCodigosAemet(conexion.db, [
      { codigoCenso: "ES620M0000002", codigoAemet: "3090206" },
    ]);

    expect(await codigos()).toEqual([null, "3090206"]);
  });

  it("si una playa de la tabla no existe, no cambia nada", async () => {
    await expect(
      importarCodigosAemet(conexion.db, [
        { codigoCenso: "ES620M0000001", codigoAemet: "3000301" },
        { codigoCenso: "ES620M9999999", codigoAemet: "3000312" },
      ]),
    ).rejects.toThrow(/ES620M9999999/);
    expect(await codigos()).toEqual([null, "3090206"]);
  });

  it("guarda un día por fila y repetirlo no cambia nada", async () => {
    const filas = filasPrevisionAemet(ids[0] ?? 0, prediccion("2026-10-23T06:51:16Z", 20));

    expect(await guardarPrevisionesAemet(conexion.db, filas)).toBe(2);
    expect(await guardarPrevisionesAemet(conexion.db, filas)).toBe(0);
    expect(await aguaGuardada()).toEqual([20, 20]);
  });

  it("una predicción más reciente sustituye a la anterior y una atrasada no", async () => {
    const playaId = ids[0] ?? 0;
    await guardarPrevisionesAemet(
      conexion.db,
      filasPrevisionAemet(playaId, prediccion("2026-10-23T06:51:16Z", 20)),
    );
    await guardarPrevisionesAemet(
      conexion.db,
      filasPrevisionAemet(playaId, prediccion("2026-10-23T12:00:00Z", 21)),
    );
    await guardarPrevisionesAemet(
      conexion.db,
      filasPrevisionAemet(playaId, prediccion("2026-10-22T06:00:00Z", 19)),
    );

    expect(await aguaGuardada()).toEqual([21, 21]);
  });
});
