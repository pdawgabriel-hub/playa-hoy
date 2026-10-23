// Hacia dónde mira una playa, a partir de la línea de costa de OpenStreetMap.
// En OSM la costa se dibuja con la tierra a la izquierda y el mar a la derecha: la playa
// mira hacia la perpendicular a la costa por la derecha.

export type Coordenadas = { lon: number; lat: number };

export type Orientacion = {
  // Rumbo hacia el mar en grados: 0 = norte, 90 = este, 180 = sur, 270 = oeste
  mira: number;
  // De 0 a 1: 1 si la costa es recta junto a la playa; baja si gira (un cabo, una cala)
  confianza: number;
};

type Opciones = {
  // Tramo de costa que se tiene en cuenta, repartido a ambos lados del punto más cercano
  ventanaM?: number;
  // Si la costa más cercana está más lejos, no se calcula
  distanciaMaximaM?: number;
};

type Vector = { x: number; y: number };

const RADIO_TIERRA_M = 6_371_000;

// Plano local en metros centrado en `origen` (x hacia el este, y hacia el norte). A pocos
// cientos de metros el error de aproximar la Tierra por un plano es despreciable.
function aPlano(origen: Coordenadas) {
  const escalaX = RADIO_TIERRA_M * Math.cos((origen.lat * Math.PI) / 180) * (Math.PI / 180);
  const escalaY = RADIO_TIERRA_M * (Math.PI / 180);
  return (p: Coordenadas): Vector => ({
    x: (p.lon - origen.lon) * escalaX,
    y: (p.lat - origen.lat) * escalaY,
  });
}

// Punto del segmento AB más cercano al origen (la playa): su posición t (0 = A, 1 = B) y la
// distancia
function proyeccionEnSegmento(a: Vector, b: Vector) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / largo2));
  return { t, distancia: Math.hypot(a.x + t * dx, a.y + t * dy) };
}

const clave = (p: Coordenadas | undefined) => `${p?.lon},${p?.lat}`;

export function calcularOrientacion(
  playa: Coordenadas,
  costa: Coordenadas[][],
  { ventanaM = 300, distanciaMaximaM = 500 }: Opciones = {},
): Orientacion | null {
  const proyectar = aPlano(playa);
  const lineas = costa.filter((l) => l.length >= 2);
  const enPlano = lineas.map((l) => l.map(proyectar));

  // Los tramos de OSM se unen por puntos comunes: el final de uno es el principio del siguiente
  const empiezaEn = new Map(lineas.map((l, i) => [clave(l[0]), i]));
  const terminaEn = new Map(lineas.map((l, i) => [clave(l.at(-1)), i]));

  // Punto de costa más cercano a la playa
  let inicio: { linea: number; segmento: number; t: number; distancia: number } | null = null;
  for (const [linea, puntos] of enPlano.entries()) {
    for (let segmento = 0; segmento < puntos.length - 1; segmento++) {
      const a = puntos[segmento];
      const b = puntos[segmento + 1];
      if (!a || !b) continue;
      const { t, distancia } = proyeccionEnSegmento(a, b);
      if (!inicio || distancia < inicio.distancia) inicio = { linea, segmento, t, distancia };
    }
  }
  if (!inicio || inicio.distancia > distanciaMaximaM) return null;
  const desde = inicio;

  // Recorre la costa desde ese punto hacia delante y hacia atrás, ventanaM / 2 en cada
  // sentido, sumando los vectores en el sentido de la línea (los tramos largos pesan más).
  // Solo cuenta la orilla de la playa: la de enfrente (en La Manga, la del Mar Menor) no está
  // unida a esta por la línea.
  let suma: Vector = { x: 0, y: 0 };
  let sumaLargos = 0;
  const vistos = new Set<string>([`${desde.linea}:${desde.segmento}`]);

  // Suma la fracción [t0, t1] del segmento sin pasarse de lo que queda; devuelve lo sumado
  const sumar = (linea: number, segmento: number, t0: number, t1: number, queda: number) => {
    const a = enPlano[linea]?.[segmento];
    const b = enPlano[linea]?.[segmento + 1];
    if (!a || !b) return 0;
    const largo = Math.hypot(b.x - a.x, b.y - a.y) * (t1 - t0);
    if (largo === 0) return 0;
    const tomado = Math.min(largo, queda);
    const escala = (tomado / largo) * (t1 - t0);
    suma = { x: suma.x + (b.x - a.x) * escala, y: suma.y + (b.y - a.y) * escala };
    sumaLargos += tomado;
    return tomado;
  };

  const recorrer = (sentido: 1 | -1) => {
    let queda = ventanaM / 2;
    // Primero, la parte del segmento más cercano que queda hacia este lado
    queda -=
      sentido === 1
        ? sumar(desde.linea, desde.segmento, desde.t, 1, queda)
        : sumar(desde.linea, desde.segmento, 0, desde.t, queda);

    let { linea, segmento } = desde;
    while (queda > 0) {
      segmento += sentido;
      if (segmento < 0 || segmento >= (enPlano[linea]?.length ?? 0) - 1) {
        // Salta al tramo siguiente (o anterior) que comparte extremo
        const siguiente =
          sentido === 1
            ? empiezaEn.get(clave(lineas[linea]?.at(-1)))
            : terminaEn.get(clave(lineas[linea]?.[0]));
        if (siguiente === undefined) return;
        linea = siguiente;
        segmento = sentido === 1 ? 0 : (enPlano[linea]?.length ?? 2) - 2;
      }
      // Una isla o un tramo cerrado: no dar vueltas
      if (vistos.has(`${linea}:${segmento}`)) return;
      vistos.add(`${linea}:${segmento}`);
      queda -= sumar(linea, segmento, 0, 1, queda);
    }
  };

  recorrer(1);
  recorrer(-1);

  const largoSuma = Math.hypot(suma.x, suma.y);
  if (sumaLargos === 0 || largoSuma === 0) return null;

  // Perpendicular por la derecha de la dirección de la costa: (dx, dy) -> (dy, -dx)
  const grados = (Math.atan2(suma.y, -suma.x) * 180) / Math.PI;
  const mira = Math.round((((grados % 360) + 360) % 360) * 10) / 10;
  return {
    mira: mira === 360 ? 0 : mira,
    confianza: Math.round((largoSuma / sumaLargos) * 100) / 100,
  };
}
