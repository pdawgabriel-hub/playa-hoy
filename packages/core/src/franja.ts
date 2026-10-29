// La mejor franja de tres horas seguidas de un día, por la nota media de un plan. Solo
// cuentan las horas de luz: una playa a las 3 de la madrugada no le sirve a nadie.
import type { Luz } from "./luz.ts";

export const HORAS_FRANJA = 3;
const HORA_MS = 3_600_000;

export type NotaHora = { hora: Date; nota: number | null };

export type Franja = {
  // De `inicio` a `fin`: las tres horas que empiezan en inicio, inicio + 1 h e inicio + 2 h
  inicio: Date;
  fin: Date;
  // Media de las tres notas, redondeada
  nota: number;
};

// Una hora es de día si entera lo es: empieza después del orto y acaba antes del ocaso
export const esHoraDeDia = (hora: Date, { orto, ocaso }: Luz) =>
  hora.getTime() >= orto.getTime() && hora.getTime() + HORA_MS <= ocaso.getTime();

// Entre las horas de luz de `luz`, las tres seguidas y con nota de mejor media. Si empatan,
// la más temprana. Null si no hay tres horas seguidas de día con nota, o si la mejor media
// es 0: no hay nada que recomendar.
export function mejorFranja(horas: NotaHora[], luz: Luz): Franja | null {
  const deLuz = horas
    .filter((h): h is { hora: Date; nota: number } => h.nota !== null && esHoraDeDia(h.hora, luz))
    .toSorted((a, b) => a.hora.getTime() - b.hora.getTime());

  let mejor: Franja | null = null;
  for (let i = 0; i + HORAS_FRANJA <= deLuz.length; i++) {
    const tramo = deLuz.slice(i, i + HORAS_FRANJA);
    const primera = tramo[0];
    const ultima = tramo.at(-1);
    if (!primera || !ultima) continue;
    // Seguidas de verdad: sin huecos por horas que faltan
    if (ultima.hora.getTime() - primera.hora.getTime() !== (HORAS_FRANJA - 1) * HORA_MS) continue;

    const media = tramo.reduce((suma, h) => suma + h.nota, 0) / HORAS_FRANJA;
    if (mejor === null || media > mejor.nota) {
      mejor = {
        inicio: primera.hora,
        fin: new Date(primera.hora.getTime() + HORAS_FRANJA * HORA_MS),
        nota: media,
      };
    }
  }
  if (mejor === null || Math.round(mejor.nota) === 0) return null;
  return { ...mejor, nota: Math.round(mejor.nota) };
}
