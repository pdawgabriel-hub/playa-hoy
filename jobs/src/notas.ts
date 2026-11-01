import { type HoraPrevision, evaluarPlaya } from "@playa-hoy/core";
import { type Db, esquema, eq, gte, isNotNull, sql } from "@playa-hoy/db";
import { enHoraEspana } from "@playa-hoy/shared";

import { truncarHora } from "./previsiones.ts";

const HORA_MS = 3_600_000;
// Horas previas que necesita la claridad: 4 semividas en el Mar Menor (ver core/claridad.ts)
const HORAS_HISTORIA = 96;
const FILAS_POR_INSERCION = 1000;

type FilaCondiciones = typeof esquema.condiciones.$inferInsert;
type FilaNota = typeof esquema.notas.$inferInsert;

// Temperatura del agua de AEMET por playa de laguna y día ("2026-10-30"): la de la playa de
// laguna con predicción de AEMET más cercana. Es la única fuente que distingue la laguna del
// Mediterráneo (ver docs/fuentes.md: parece un valor climatológico).
async function aguaAemetLaguna(db: Db, desde: string) {
  const filas = await db.execute<{ playa_id: number; fecha: string; temperatura_agua: number }>(sql`
    SELECT p.id AS playa_id, pa.fecha::text AS fecha, pa.temperatura_agua
    FROM playas p
    CROSS JOIN LATERAL (
      SELECT a.id FROM playas a
      WHERE a.laguna AND EXISTS (SELECT 1 FROM previsiones_aemet x WHERE x.playa_id = a.id)
      ORDER BY a.ubicacion::geography <-> p.ubicacion::geography
      LIMIT 1
    ) cercana
    JOIN previsiones_aemet pa ON pa.playa_id = cercana.id
    WHERE p.laguna AND pa.fecha >= ${desde}::date AND pa.temperatura_agua IS NOT NULL
  `);
  const porPlaya = new Map<number, Map<string, number>>();
  for (const { playa_id, fecha, temperatura_agua } of filas) {
    const dias = porPlaya.get(playa_id) ?? new Map<string, number>();
    dias.set(fecha, temperatura_agua);
    porPlaya.set(playa_id, dias);
  }
  return porPlaya;
}

// Calcula las condiciones y las notas de todas las playas desde la hora actual hasta donde
// llegue la previsión, con la última emisión de cada hora, y sustituye las anteriores.
export async function calcularNotas(db: Db, { ahora = new Date() }: { ahora?: Date } = {}) {
  const desde = truncarHora(ahora);
  const inicioHistoria = new Date(desde.getTime() - HORAS_HISTORIA * HORA_MS);
  const { playas: tPlayas, playaServicios: tServicios, previsiones: tPrevisiones } = esquema;

  const playas = await db
    .select({
      id: tPlayas.id,
      mira: tPlayas.mira,
      laguna: tPlayas.laguna,
      alcances: tPlayas.alcances,
      puntoConsultaId: tPlayas.puntoConsultaId,
      suelo: tServicios.suelo,
      socorrista: tServicios.socorrista,
    })
    .from(tPlayas)
    .leftJoin(tServicios, eq(tServicios.playaId, tPlayas.id))
    .where(isNotNull(tPlayas.puntoConsultaId));

  // De cada punto y hora, la previsión de la última emisión
  const previsiones = await db
    .selectDistinctOn([tPrevisiones.puntoId, tPrevisiones.hora])
    .from(tPrevisiones)
    .where(gte(tPrevisiones.hora, inicioHistoria))
    .orderBy(tPrevisiones.puntoId, tPrevisiones.hora, sql`${tPrevisiones.emitidaEn} DESC`);
  const porPunto = Map.groupBy(previsiones, (p) => p.puntoId);
  const agua = await aguaAemetLaguna(db, enHoraEspana(desde).fecha);

  const filasCondiciones: FilaCondiciones[] = [];
  const filasNotas: FilaNota[] = [];
  let horasConAguaAemet = 0;
  for (const playa of playas) {
    const serie = porPunto.get(playa.puntoConsultaId ?? 0) ?? [];
    const emitida = new Map(serie.map((p) => [p.hora.getTime(), p.emitidaEn]));
    const aguaPorDia = agua.get(playa.id);
    const horas: HoraPrevision[] = serie.map((p) => ({
      hora: p.hora,
      olaAltura: p.olaAltura,
      olaDireccion: p.olaDireccion,
      olaPeriodo: p.olaPeriodo,
      vientoVelocidad: p.vientoVelocidad,
      vientoDireccion: p.vientoDireccion,
      temperaturaAire: p.temperaturaAire,
      temperaturaAgua: aguaPorDia?.get(enHoraEspana(p.hora).fecha) ?? p.temperaturaAgua,
      nubosidad: p.nubosidad,
    }));

    for (const h of evaluarPlaya(playa, horas, desde)) {
      const emitidaEn = emitida.get(h.hora.getTime()) ?? desde;
      const deAemet = aguaPorDia?.has(enHoraEspana(h.hora).fecha) ?? false;
      if (deAemet) horasConAguaAemet++;
      filasCondiciones.push({
        playaId: playa.id,
        hora: h.hora,
        olaOrilla: h.condiciones.olaOrilla,
        olaPeriodo: h.condiciones.olaPeriodo,
        entradaViento: h.condiciones.entradaViento,
        claridad: h.claridad?.claridad ?? null,
        estadoAgua: h.claridad?.estado ?? null,
        temperaturaAgua: h.condiciones.temperaturaAgua,
        fuenteTemperaturaAgua:
          h.condiciones.temperaturaAgua === null ? null : deAemet ? "aemet" : "open_meteo",
        bandera: h.bandera?.bandera ?? null,
        emitidaEn,
      });
      for (const [perfil, nota] of Object.entries(h.notas)) {
        if (!nota) continue;
        filasNotas.push({ playaId: playa.id, perfil, hora: h.hora, ...nota, emitidaEn });
      }
    }
  }

  // Sustituye el cálculo anterior entero: quien lea ve el viejo o el nuevo, nunca una mezcla
  await db.transaction(async (tx) => {
    await tx.delete(esquema.notas);
    await tx.delete(esquema.condiciones);
    for (let i = 0; i < filasCondiciones.length; i += FILAS_POR_INSERCION) {
      await tx
        .insert(esquema.condiciones)
        .values(filasCondiciones.slice(i, i + FILAS_POR_INSERCION));
    }
    for (let i = 0; i < filasNotas.length; i += FILAS_POR_INSERCION) {
      await tx.insert(esquema.notas).values(filasNotas.slice(i, i + FILAS_POR_INSERCION));
    }
  });

  return {
    playas: playas.length,
    horas: filasCondiciones.length,
    notas: filasNotas.length,
    horasConAguaAemet,
  };
}
