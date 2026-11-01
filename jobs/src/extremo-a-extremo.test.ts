// De extremo a extremo: la cadena entera, con datos reales y sin red. El catálogo sale de los
// ficheros de jobs/datos, la geografía de 8 playas de referencia del fixture de core, y la
// previsión de Open-Meteo y AEMET de respuestas reales simuladas con MSW. Después se calculan
// las notas y se consulta la API como lo haría la web. Comprueba que lo que escriben los jobs
// es lo que la API sabe leer.
import { crearApp } from "@playa-hoy/api";
import referencia from "@playa-hoy/core/pruebas/playas-referencia.json" with { type: "json" };
import { eq, esquema, inArray } from "@playa-hoy/db";
import { crearBaseDatosPrueba } from "@playa-hoy/db/pruebas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import censo from "../datos/censo-2025-murcia.json" with { type: "json" };
import correcciones from "../datos/correcciones-censo.json" with { type: "json" };
import correspondenciasAemet from "../datos/correspondencias-aemet.json" with { type: "json" };
import municipios from "../datos/municipios.json" with { type: "json" };
import zonas from "../datos/zonas.json" with { type: "json" };
import { importarMunicipios, leerMunicipios } from "./municipios.ts";
import { calcularNotas } from "./notas.ts";
import { importarCodigosAemet, ingerirAemet, leerCorrespondenciasAemet } from "./playas-aemet.ts";
import { importarPlayasCenso, prepararPlayasCenso } from "./playas-censo.ts";
import { ingerirPrevisiones } from "./previsiones.ts";
import { simularAemet } from "./pruebas/aemet.ts";
import { simularOpenMeteo } from "./pruebas/open-meteo.ts";
import { importarPuntosConsulta } from "./puntos-consulta.ts";
import { importarZonas, leerZonas } from "./zonas.ts";

const url = process.env.DATABASE_URL ?? "";
// Las respuestas simuladas son del 23 de octubre de 2026; a las 12:20 en España
const AHORA = new Date("2026-10-23T10:20:00Z");
const rapido = { esperaMs: 1, esperaTrasLimiteMs: 1 };

const Lista = z.object({
  datos: z.array(z.looseObject({ nombre: z.string(), playas: z.number() })),
});
const Ranking = z.object({
  horaLocal: z.string(),
  playas: z.array(
    z.object({
      posicion: z.number(),
      playa: z.looseObject({ id: z.number(), nombre: z.string() }),
      nota: z.number(),
      razones: z.array(z.object({ tipo: z.string(), texto: z.string() })),
    }),
  ),
});
const Hoy = z.object({
  fecha: z.string(),
  horas: z.array(
    z.looseObject({
      horaLocal: z.string(),
      deDia: z.boolean(),
      olaOrilla: z.number().nullable(),
      temperaturaAgua: z.number().nullable(),
      fuenteTemperaturaAgua: z.string().nullable(),
      notas: z.object({
        familia: z.object({ nota: z.number() }).nullable(),
        snorkel: z.unknown(),
        sol: z.unknown(),
        surf: z.unknown(),
      }),
    }),
  ),
  franjas: z.looseObject({ familia: z.looseObject({ nota: z.number() }).nullable() }),
});

// Las playas de referencia del Mediterráneo o de la laguna
const grupoDe = (laguna: boolean, ids: Map<string, number>) =>
  referencia.playas.filter((p) => p.laguna === laguna).map((p) => ids.get(p.nombre) ?? 0);
const suma = (lista: { playas: number }[]) => lista.reduce((s, x) => s + x.playas, 0);

describe.skipIf(!url)("de extremo a extremo: de las fuentes a la API", () => {
  let conexion: Awaited<ReturnType<typeof crearBaseDatosPrueba>>;
  let app: ReturnType<typeof crearApp>;
  const ids = new Map<string, number>();

  const pedir = async <T>(ruta: string, esquemaRespuesta: z.ZodType<T>) => {
    const res = await app.request(ruta);
    expect(res.status, ruta).toBe(200);
    return esquemaRespuesta.parse(await res.json());
  };

  beforeAll(async () => {
    conexion = await crearBaseDatosPrueba(url);
    const { db } = conexion;

    // 1. Catálogo, desde los ficheros de jobs/datos
    const listaMunicipios = leerMunicipios(municipios);
    await importarMunicipios(db, listaMunicipios);
    const { playas } = prepararPlayasCenso(
      censo,
      correcciones,
      new Map(listaMunicipios.map((m) => [m.id, m.slug])),
    );
    await importarPlayasCenso(db, playas);
    await importarZonas(db, leerZonas(zonas));
    await importarCodigosAemet(db, leerCorrespondenciasAemet(correspondenciasAemet));

    // 2. La geografía real de las 8 playas de referencia (la línea de costa necesitaría red)
    for (const p of referencia.playas) {
      const [fila] = await db
        .update(esquema.playas)
        .set({ mira: p.mira, abrigo: p.abrigo, laguna: p.laguna, alcances: p.alcances })
        .where(eq(esquema.playas.codigoCenso, p.codigoCenso))
        .returning({ id: esquema.playas.id });
      ids.set(p.nombre, fila?.id ?? 0);
    }

    // Las 22 playas de la zona Mar Menor son la orilla interior de la laguna: calcular:geografia
    // las marca de laguna, y el job de notas busca entre ellas el agua de AEMET
    const [marMenor] = await db
      .select({ id: esquema.zonas.id })
      .from(esquema.zonas)
      .where(eq(esquema.zonas.slug, "mar-menor"));
    await db
      .update(esquema.playas)
      .set({ laguna: true })
      .where(eq(esquema.playas.zonaId, marMenor?.id ?? 0));

    // 3. Dos puntos de consulta, como los que agrupa calcular:puntos: el Mediterráneo y la laguna
    await importarPuntosConsulta(db, [
      { celdas: "mediterraneo", ubicacion: { lat: 37.7, lon: -0.71 }, playas: grupoDe(false, ids) },
      { celdas: "laguna", ubicacion: { lat: 37.74, lon: -0.85 }, playas: grupoDe(true, ids) },
    ]);

    // 4. La previsión, de las respuestas reales simuladas
    simularOpenMeteo();
    await ingerirPrevisiones(db, { ahora: AHORA, red: rapido });
    simularAemet();
    await ingerirAemet(db, "clave", { ...rapido, pausaMs: 1 });

    // 5. Las notas, como tras cada ingesta
    await calcularNotas(db, { ahora: AHORA });

    app = crearApp(db, { reloj: () => AHORA });
  });

  afterAll(async () => {
    await conexion?.borrar();
  });

  it("el catálogo completo: 8 municipios y 83 playas, repartidas en 8 zonas", async () => {
    const { datos: deMunicipios } = await pedir("/v1/municipios", Lista);
    const { datos: deZonas } = await pedir("/v1/zonas", Lista);

    expect(deMunicipios).toHaveLength(8);
    expect(suma(deMunicipios)).toBe(83);
    expect(deZonas).toHaveLength(8);
    expect(suma(deZonas)).toBe(83);
  });

  it("el ranking de familia trae las playas con geografía, ordenadas y con sus razones", async () => {
    const { horaLocal, playas } = await pedir("/v1/ranking?plan=familia&limite=100", Ranking);

    expect(horaLocal).toBe("12:00");
    expect(playas.map((p) => p.playa.nombre).toSorted()).toEqual(
      referencia.playas.map((p) => p.nombre).toSorted(),
    );
    expect(playas.every((p, i) => i === 0 || p.nota <= (playas[i - 1]?.nota ?? 100))).toBe(true);
    expect(playas.every((p) => p.razones.length > 0)).toBe(true);
  });

  it("el día de una playa coincide con el ranking: misma nota a la misma hora", async () => {
    const { playas } = await pedir("/v1/ranking?plan=familia&limite=100", Ranking);
    const galua = playas.find((p) => p.playa.nombre === "Galúa");
    const hoy = await pedir(`/v1/playas/${String(ids.get("Galúa"))}/hoy`, Hoy);
    const doce = hoy.horas.find((h) => h.horaLocal === "12:00");

    expect(hoy.fecha).toBe("2026-10-23");
    expect(doce?.notas.familia?.nota).toBe(galua?.nota);
    expect(doce?.deDia).toBe(true);
    expect(doce?.olaOrilla).not.toBeNull();
  });

  it("en el Mar Menor el agua sale de AEMET; en el Mediterráneo, de Open-Meteo", async () => {
    const galan = await pedir(`/v1/playas/${String(ids.get("El Galán"))}/hoy`, Hoy);
    const portus = await pedir(`/v1/playas/${String(ids.get("El Portús"))}/hoy`, Hoy);

    expect(galan.horas[0]).toMatchObject({ fuenteTemperaturaAgua: "aemet", temperaturaAgua: 20 });
    expect(portus.horas[0]?.fuenteTemperaturaAgua).toBe("open_meteo");
  });

  it("cada playa con previsión tiene su mejor franja de familia y su resumen de la semana", async () => {
    const id = String(ids.get("Bolnuevo"));
    const hoy = await pedir(`/v1/playas/${id}/hoy`, Hoy);
    const semana = await pedir(
      `/v1/playas/${id}/semana`,
      z.object({ dias: z.array(z.looseObject({ fecha: z.string() })) }),
    );

    expect(hoy.franjas.familia?.nota).toBeGreaterThan(0);
    expect(semana.dias.map((d) => d.fecha)).toEqual(["2026-10-23"]);
  });

  it("las playas cercanas a Galúa empiezan por Galúa, con su nota", async () => {
    const [galua] = await conexion.db
      .select({ ubicacion: esquema.playas.ubicacion })
      .from(esquema.playas)
      .where(inArray(esquema.playas.id, [ids.get("Galúa") ?? 0]));
    const { x: lon, y: lat } = galua?.ubicacion ?? { x: 0, y: 0 };
    const cerca = await pedir(
      `/v1/playas/cerca?lat=${String(lat)}&lon=${String(lon)}&plan=familia&limite=3`,
      z.object({
        playas: z.array(
          z.object({
            playa: z.looseObject({ nombre: z.string() }),
            distanciaM: z.number(),
            nota: z.object({ nota: z.number() }).nullable(),
          }),
        ),
      }),
    );

    expect(cerca.playas[0]).toMatchObject({ playa: { nombre: "Galúa" }, distanciaM: 0 });
    expect(cerca.playas[0]?.nota).not.toBeNull();
  });
});
