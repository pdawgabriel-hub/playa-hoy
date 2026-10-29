// Une las piezas del motor para una playa: de la serie de previsión por horas a las
// condiciones de cada hora, las notas de los cuatro planes con sus razones y la bandera.
import { type BanderaProbable, banderaProbable } from "./bandera.ts";
import { type Claridad, estimarClaridad, fondoDePlaya } from "./claridad.ts";
import { type PlayaOleaje, oleajeEnOrilla } from "./oleaje.ts";
import type { Condiciones, NotaPerfil, Perfil } from "./perfiles/comun.ts";
import { notaFamilia } from "./perfiles/familia.ts";
import { notaSnorkel } from "./perfiles/snorkel.ts";
import { notaSol } from "./perfiles/sol.ts";
import { notaSurf } from "./perfiles/surf.ts";
import { type Razon, generarRazones } from "./razones.ts";
import type { Suelo } from "./suelo.ts";
import { entradaViento } from "./viento.ts";

export type PlayaEvaluada = PlayaOleaje & { suelo: Suelo | null; socorrista: boolean | null };

// Una hora de previsión mar adentro, como se guarda en la tabla previsiones
export type HoraPrevision = {
  hora: Date;
  olaAltura: number | null;
  olaDireccion: number | null;
  olaPeriodo: number | null;
  vientoVelocidad: number | null;
  vientoDireccion: number | null;
  temperaturaAire: number | null;
  temperaturaAgua: number | null;
  nubosidad: number | null;
};

export type NotaConRazones = { nota: number; razones: Razon[] };

export type HoraEvaluada = {
  hora: Date;
  condiciones: Condiciones;
  claridad: Claridad | null;
  bandera: BanderaProbable | null;
  notas: Record<Perfil, NotaConRazones | null>;
};

const PERFILES: Record<Perfil, (c: Condiciones) => NotaPerfil | null> = {
  familia: notaFamilia,
  snorkel: notaSnorkel,
  sol: notaSol,
  surf: notaSurf,
};

// `horas`: la serie de la playa, también las horas pasadas que hagan falta para la claridad
// (hasta 96 h en el Mar Menor). Solo se evalúan las horas desde `desde`.
export function evaluarPlaya(
  playa: PlayaEvaluada,
  horas: HoraPrevision[],
  desde: Date,
): HoraEvaluada[] {
  const ordenadas = horas.toSorted((a, b) => a.hora.getTime() - b.hora.getTime());
  const olas = ordenadas.map((h) => oleajeEnOrilla(playa, h));
  const fondo = fondoDePlaya(playa.suelo, playa.laguna);

  const evaluadas: HoraEvaluada[] = [];
  for (const [i, h] of ordenadas.entries()) {
    if (h.hora.getTime() < desde.getTime()) continue;
    const ola = olas[i] ?? null;
    const claridad = estimarClaridad(
      olas.slice(0, i + 1).map((o) => o?.altura ?? null),
      fondo,
    );
    const entrada =
      entradaViento(playa.mira, h.vientoDireccion, h.vientoVelocidad)?.entrada ?? null;
    const condiciones: Condiciones = {
      olaOrilla: ola?.altura ?? null,
      olaPeriodo: ola?.periodo ?? null,
      vientoVelocidad: h.vientoVelocidad,
      entradaViento: entrada,
      temperaturaAire: h.temperaturaAire,
      temperaturaAgua: h.temperaturaAgua,
      nubosidad: h.nubosidad,
      claridad: claridad?.claridad ?? null,
      socorrista: playa.socorrista,
      suelo: playa.suelo,
    };

    const puntuar = (perfil: Perfil): NotaConRazones | null => {
      const nota = PERFILES[perfil](condiciones);
      return nota && { nota: nota.nota, razones: generarRazones(perfil, nota, condiciones) };
    };

    evaluadas.push({
      hora: h.hora,
      condiciones,
      claridad,
      bandera: banderaProbable(condiciones.olaOrilla, h.vientoVelocidad, entrada),
      notas: {
        familia: puntuar("familia"),
        snorkel: puntuar("snorkel"),
        sol: puntuar("sol"),
        surf: puntuar("surf"),
      },
    });
  }
  return evaluadas;
}
