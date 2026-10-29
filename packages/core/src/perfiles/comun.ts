// Piezas comunes de los perfiles: las condiciones de una playa a una hora, las rampas que
// convierten cada dato en un factor de 0 a 1 y la forma de combinarlos en una nota.
import type { Suelo } from "../suelo.ts";
import type { Entrada } from "../viento.ts";

// Lo que se sabe de una playa a una hora, ya calculado por el resto del motor. Nulo es que
// no se sabe.
export type Condiciones = {
  // Ola en la orilla, en m (oleajeEnOrilla)
  olaOrilla: number | null;
  // Periodo de la ola en s (oleajeEnOrilla): en el Mar Menor, el de la ola de viento local
  olaPeriodo: number | null;
  // km/h
  vientoVelocidad: number | null;
  entradaViento: Entrada | null;
  // °C
  temperaturaAire: number | null;
  temperaturaAgua: number | null;
  // % de cielo cubierto
  nubosidad: number | null;
  // De 1 (agua quieta) a 0 (estimarClaridad)
  claridad: number | null;
  socorrista: boolean | null;
  // Suelo de la playa (ITREM)
  suelo: Suelo | null;
};

export type Factor = {
  nombre: string;
  // De 0 a 1; nulo si falta el dato
  valor: number | null;
  peso: number;
};

export type NotaPerfil = {
  // De 0 a 100
  nota: number;
  factores: Factor[];
};

// 1 en `bueno` y 0 en `malo`, en línea recta entre los dos y fijo fuera de ese tramo. Sirve
// en los dos sentidos: rampa(ola, 0.2, 0.6) baja con la ola; rampa(agua, 24, 18) sube con
// la temperatura.
export function rampa(valor: number, bueno: number, malo: number): number {
  const t = (valor - bueno) / (malo - bueno);
  return Math.min(1, Math.max(0, 1 - t));
}

// 1 entre `desde` y `hasta`, y bajando en rampa hasta 0 en `minimo` y en `maximo`
export function meseta(
  valor: number,
  minimo: number,
  desde: number,
  hasta: number,
  maximo: number,
): number {
  return valor < desde ? rampa(valor, desde, minimo) : rampa(valor, hasta, maximo);
}

// Un factor de comodidad resta pero no veta: nunca baja de `suelo`
export const conSuelo = (valor: number, suelo: number) => suelo + (1 - suelo) * valor;

// Media geométrica ponderada: nota = 100 × Π factor^peso, con los pesos de los factores
// conocidos repartidos para que sumen 1. Un factor en 0 deja la nota en 0: así un factor de
// seguridad veta la playa aunque todo lo demás sea perfecto.
export function combinar(factores: Factor[]): NotaPerfil {
  const redondeados = factores.map((f) => ({
    ...f,
    valor: f.valor === null ? null : Math.round(f.valor * 100) / 100,
  }));
  const conocidos = factores.filter((f) => f.valor !== null);
  const pesos = conocidos.reduce((suma, f) => suma + f.peso, 0);
  let logaritmo = 0;
  for (const { valor, peso } of conocidos) {
    if (valor === 0) return { nota: 0, factores: redondeados };
    logaritmo += (peso / pesos) * Math.log(valor ?? 1);
  }
  return { nota: Math.round(100 * Math.exp(logaritmo)), factores: redondeados };
}
