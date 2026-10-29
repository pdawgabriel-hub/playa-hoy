// Lo que la API sabe de una playa en un día: sus horas con condiciones y notas, y la mejor
// franja de cada plan
import {
  type Franja,
  type Perfil,
  esHoraDeDia,
  mejorFranja,
  ortoYOcaso,
  vientoLocal,
} from "@playa-hoy/core";
import { type Db, esquema } from "@playa-hoy/db";
import { enHoraEspana, horaEspanaAUtc } from "@playa-hoy/shared";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

const DIA_MS = 86_400_000;

// Un día del calendario de España en UTC: de las 00:00 a las 00:00 del día siguiente. Los
// días de cambio de hora tienen 23 o 25 horas.
export function limitesDelDia(fecha: string) {
  const siguiente = new Date(Date.parse(`${fecha}T12:00:00Z`) + DIA_MS).toISOString().slice(0, 10);
  return {
    inicio: horaEspanaAUtc(`${fecha}T00:00:00`),
    fin: horaEspanaAUtc(`${siguiente}T00:00:00`),
  };
}

export async function cargarPlaya(db: Db, id: number) {
  const { playas, municipios, zonas, playaServicios } = esquema;
  const [fila] = await db
    .select({
      playa: playas,
      municipio: { id: municipios.id, nombre: municipios.nombre, slug: municipios.slug },
      zona: { id: zonas.id, nombre: zonas.nombre, slug: zonas.slug },
      socorrista: playaServicios.socorrista,
    })
    .from(playas)
    .innerJoin(municipios, eq(municipios.id, playas.municipioId))
    .leftJoin(zonas, eq(zonas.id, playas.zonaId))
    .leftJoin(playaServicios, eq(playaServicios.playaId, playas.id))
    .where(eq(playas.id, id));
  if (!fila) return null;
  const { playa, municipio, zona, socorrista } = fila;
  return {
    breve: {
      id: playa.id,
      nombre: playa.nombre,
      slug: playa.slug,
      municipio,
      zona,
      laguna: playa.laguna,
    },
    ubicacion: { lat: playa.ubicacion.y, lon: playa.ubicacion.x },
    puntoConsultaId: playa.puntoConsultaId,
    socorrista,
  };
}

type Playa = NonNullable<Awaited<ReturnType<typeof cargarPlaya>>>;

const local = (fecha: Date) => enHoraEspana(fecha).hora;

// Las horas de la playa entre `inicio` y `fin` que tienen condiciones calculadas
export async function cargarHoras(db: Db, playa: Playa, inicio: Date, fin: Date) {
  const { condiciones, notas, previsiones } = esquema;
  const id = playa.breve.id;

  const filas = await db
    .select()
    .from(condiciones)
    .where(
      and(eq(condiciones.playaId, id), gte(condiciones.hora, inicio), lt(condiciones.hora, fin)),
    )
    .orderBy(asc(condiciones.hora));
  const filasNotas = await db
    .select()
    .from(notas)
    .where(and(eq(notas.playaId, id), gte(notas.hora, inicio), lt(notas.hora, fin)));
  // Viento, aire y nubes, de la última emisión de cada hora
  const tiempo =
    playa.puntoConsultaId === null
      ? []
      : await db
          .selectDistinctOn([previsiones.hora])
          .from(previsiones)
          .where(
            and(
              eq(previsiones.puntoId, playa.puntoConsultaId),
              gte(previsiones.hora, inicio),
              lt(previsiones.hora, fin),
            ),
          )
          .orderBy(previsiones.hora, desc(previsiones.emitidaEn));

  const tiempoPorHora = new Map(tiempo.map((t) => [t.hora.getTime(), t]));
  const notasPorHora = Map.groupBy(filasNotas, (n) => n.hora.getTime());

  return filas.map((c) => {
    const t = tiempoPorHora.get(c.hora.getTime());
    const deLaHora = new Map((notasPorHora.get(c.hora.getTime()) ?? []).map((n) => [n.perfil, n]));
    const nota = (perfil: Perfil) => {
      const n = deLaHora.get(perfil);
      return n ? { nota: n.nota, razones: n.razones } : null;
    };
    const direccion = t?.vientoDireccion ?? null;
    return {
      hora: c.hora.toISOString(),
      horaLocal: local(c.hora),
      olaOrilla: c.olaOrilla,
      olaPeriodo: c.olaPeriodo,
      viento: {
        velocidad: t?.vientoVelocidad ?? null,
        racha: t?.vientoRacha ?? null,
        direccion,
        nombre: direccion === null ? null : vientoLocal(direccion).nombre,
        entrada: c.entradaViento,
      },
      temperaturaAire: t?.temperaturaAire ?? null,
      temperaturaAgua: c.temperaturaAgua,
      fuenteTemperaturaAgua: c.fuenteTemperaturaAgua,
      nubosidad: t?.nubosidad ?? null,
      claridad: c.claridad,
      estadoAgua: c.estadoAgua,
      // Sin socorrista no se iza bandera
      bandera: playa.socorrista === true ? c.bandera : null,
      notas: {
        familia: nota("familia"),
        snorkel: nota("snorkel"),
        sol: nota("sol"),
        surf: nota("surf"),
      },
    };
  });
}

type Hora = Awaited<ReturnType<typeof cargarHoras>>[number];

const formatoFranja = (franja: Franja | null) =>
  franja && {
    inicio: franja.inicio.toISOString(),
    fin: franja.fin.toISOString(),
    inicioLocal: local(franja.inicio),
    finLocal: local(franja.fin),
    nota: franja.nota,
  };

// Completa las horas de un día con la luz: si cada hora es de día (las notas de noche no
// sirven para ir a la playa) y la mejor franja de tres horas de cada plan
export function completarDia(playa: Playa, horas: Hora[], fecha: string) {
  const luz = ortoYOcaso(fecha, playa.ubicacion.lat, playa.ubicacion.lon);
  const franja = (perfil: Perfil) =>
    luz === null
      ? null
      : formatoFranja(
          mejorFranja(
            horas.map((h) => ({ hora: new Date(h.hora), nota: h.notas[perfil]?.nota ?? null })),
            luz,
          ),
        );
  return {
    luz: luz && {
      orto: luz.orto.toISOString(),
      ocaso: luz.ocaso.toISOString(),
      ortoLocal: local(luz.orto),
      ocasoLocal: local(luz.ocaso),
    },
    horas: horas.map((h) => ({
      ...h,
      deDia: luz !== null && esHoraDeDia(new Date(h.hora), luz),
    })),
    franjas: {
      familia: franja("familia"),
      snorkel: franja("snorkel"),
      sol: franja("sol"),
      surf: franja("surf"),
    },
  };
}
