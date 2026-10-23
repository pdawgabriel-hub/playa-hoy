// Las dos ingestas de principio a fin: base de datos real y APIs simuladas con MSW.
import { esquema } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registrarIngesta } from "./ingestas.ts";
import { ingerirAemet } from "./playas-aemet.ts";
import { ingerirPrevisiones } from "./previsiones.ts";
import { simularAemet } from "./pruebas/aemet.ts";
import { simularOpenMeteo } from "./pruebas/open-meteo.ts";

const url = process.env.DATABASE_URL ?? "";
const rapido = { esperaMs: 1, esperaTrasLimiteMs: 1 };
// 10:20 UTC: se guardan las horas de 10:00 a 23:00, 14 por punto
const AHORA = new Date("2026-10-23T10:20:00Z");

describe.skipIf(!url)("ingestas completas con las APIs simuladas", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;

  const ultimaIngesta = async () =>
    (await conexion.db.select().from(esquema.ingestas).orderBy(asc(esquema.ingestas.id))).at(-1);

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const { db } = conexion;
    await db
      .insert(esquema.municipios)
      .values({ id: "30902", nombre: "Los Alcázares", slug: "los-alcazares" });
    const puntos = await db
      .insert(esquema.puntosConsulta)
      .values([
        { celdas: "a", ubicacion: { x: -0.71, y: 37.71 } },
        { celdas: "b", ubicacion: { x: -0.85, y: 37.74 } },
      ])
      .returning({ id: esquema.puntosConsulta.id });
    await db.insert(esquema.playas).values(
      puntos.map((punto, i) => ({
        nombre: `Playa ${i.toString()}`,
        slug: `playa-${i.toString()}`,
        municipioId: "30902",
        ubicacion: { x: -0.8, y: 37.7 + i / 100 },
        codigoCenso: `ES620M000000${i.toString()}`,
        codigoAemet: ["3090206", "3001676"][i],
        puntoConsultaId: punto.id,
      })),
    );
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  const ingerirAemetDePrueba = (clave: string) =>
    registrarIngesta(conexion.db, "aemet", () =>
      ingerirAemet(conexion.db, clave, { ...rapido, pausaMs: 1 }),
    );

  describe("Open-Meteo", () => {
    it("guarda la emisión de cada punto desde la hora actual y lo registra como ok", async () => {
      const urls = simularOpenMeteo();
      const registro = await registrarIngesta(conexion.db, "open_meteo", () =>
        ingerirPrevisiones(conexion.db, { ahora: AHORA, red: rapido }),
      );

      expect(registro).toMatchObject({ estado: "ok", filas: 28, errores: [] });
      expect(await conexion.db.$count(esquema.previsiones)).toBe(28);
      // Una petición a Marine y dos a Forecast, con los dos puntos a la vez
      expect(urls).toHaveLength(3);
      expect(urls.every((u) => u.searchParams.get("latitude") === "37.71,37.74")).toBe(true);
    });

    it("repetirla en la misma hora no duplica nada", async () => {
      simularOpenMeteo();
      await registrarIngesta(conexion.db, "open_meteo", () =>
        ingerirPrevisiones(conexion.db, { ahora: AHORA, red: rapido }),
      );

      expect(await conexion.db.$count(esquema.previsiones)).toBe(28);
    });

    it("si Marine cae, no guarda una emisión sin oleaje y lo registra como error", async () => {
      simularOpenMeteo({ marineFalla: 503 });
      const unaHoraDespues = new Date(AHORA.getTime() + 3_600_000);
      const registro = await registrarIngesta(conexion.db, "open_meteo", () =>
        ingerirPrevisiones(conexion.db, { ahora: unaHoraDespues, red: rapido }),
      );

      expect(registro.estado).toBe("error");
      expect(registro.errores).toEqual([
        expect.stringMatching(/^marine-api\.open-meteo\.com falló.*503/),
      ]);
      expect(await conexion.db.$count(esquema.previsiones)).toBe(28);
      expect((await ultimaIngesta())?.estado).toBe("error");
    });

    it("si caen las dos APIs, registra los dos errores", async () => {
      simularOpenMeteo({ marineFalla: 500, forecastFalla: 500 });
      const registro = await registrarIngesta(conexion.db, "open_meteo", () =>
        ingerirPrevisiones(conexion.db, { ahora: AHORA, red: rapido }),
      );

      expect(registro.errores).toHaveLength(2);
    });
  });

  describe("AEMET", () => {
    it("guarda los tres días de cada playa y lo registra como ok", async () => {
      simularAemet({ clave: "clave-buena" });

      expect(await ingerirAemetDePrueba("clave-buena")).toMatchObject({ estado: "ok", filas: 6 });
      expect(await conexion.db.$count(esquema.previsionesAemet)).toBe(6);
    });

    it("si cae una playa, guarda las demás y lo registra como parcial", async () => {
      await conexion.db.delete(esquema.previsionesAemet);
      simularAemet({ caidas: ["3001676"] });
      const registro = await ingerirAemetDePrueba("clave-buena");

      expect(registro).toMatchObject({ estado: "parcial", filas: 3 });
      expect(registro.errores).toEqual([expect.stringMatching(/^playa 3001676: .*HTTP 500/)]);
      const [playa] = await conexion.db
        .select({ id: esquema.playas.id })
        .from(esquema.playas)
        .where(eq(esquema.playas.codigoAemet, "3090206"));
      expect(
        await conexion.db.$count(
          esquema.previsionesAemet,
          eq(esquema.previsionesAemet.playaId, playa?.id ?? 0),
        ),
      ).toBe(3);
    });

    it("con una clave que no vale, para enseguida y lo registra como error", async () => {
      const peticiones = simularAemet({ clave: "clave-buena" });
      const registro = await ingerirAemetDePrueba("clave-caducada");

      expect(registro).toMatchObject({ estado: "error", filas: 0 });
      expect(registro.errores).toEqual([expect.stringMatching(/HTTP 401/)]);
      expect(peticiones).toHaveLength(1);
    });
  });
});
