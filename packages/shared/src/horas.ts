// Horas: todo se guarda y se calcula en UTC. La hora de España solo aparece en dos sitios:
// al leer fuentes que la dan sin zona horaria (AEMET) y al mostrar los datos a la gente.
// Nada depende de la zona horaria de la máquina: los tests corren en UTC+14 para probarlo.

export const ZONA_HORARIA = "Europe/Madrid";

// Desfase de la hora de España respecto a UTC en un instante, en milisegundos
function desfaseEspana(instante: number) {
  const zona = new Intl.DateTimeFormat("en", { timeZone: ZONA_HORARIA, timeZoneName: "longOffset" })
    .formatToParts(instante)
    .find((p) => p.type === "timeZoneName")?.value;
  const partes = /GMT([+-])(\d{2}):(\d{2})/.exec(zona ?? "");
  if (!partes) return 0;
  const minutos = Number(partes[2]) * 60 + Number(partes[3]);
  return (partes[1] === "-" ? -minutos : minutos) * 60_000;
}

// "2026-10-23T08:51:16" en hora de España, sin zona horaria, pasado a UTC. El desfase
// depende del propio instante (horario de verano o de invierno), así que se ajusta dos veces.
export function horaEspanaAUtc(texto: string): Date {
  const comoSiFueraUtc = new Date(`${texto}Z`).getTime();
  if (Number.isNaN(comoSiFueraUtc)) throw new Error(`Hora no válida: ${texto}`);
  const aproximada = comoSiFueraUtc - desfaseEspana(comoSiFueraUtc);
  return new Date(comoSiFueraUtc - desfaseEspana(aproximada));
}

const formatoEspana = new Intl.DateTimeFormat("en", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Un instante en hora de España, para mostrarlo: { fecha: "2026-10-23", hora: "08:51" }
export function enHoraEspana(instante: Date): { fecha: string; hora: string } {
  const partes = Object.fromEntries(
    formatoEspana.formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return {
    fecha: `${partes.year ?? ""}-${partes.month ?? ""}-${partes.day ?? ""}`,
    hora: `${partes.hour ?? ""}:${partes.minute ?? ""}`,
  };
}
