// Límite de peticiones por IP: 60 por minuto, con ventana deslizante. En producción lo lleva
// Upstash Redis, compartido entre las instancias de Vercel. Si el limitador falla o tarda, la
// petición pasa: la API no debe caerse por culpa del limitador.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createMiddleware } from "hono/factory";

import { cuerpoError } from "./errores.ts";

export const PETICIONES_POR_MINUTO = 60;
// Si Upstash no responde en este tiempo, se deja pasar la petición
const ESPERA_MAXIMA_MS = 1000;
const MINUTO_MS = 60_000;

export type ResultadoLimite = {
  permitido: boolean;
  limite: number;
  restantes: number;
  // Cuándo se recupera el cupo, en ms desde 1970
  reinicio: number;
};

export type Limitador = (clave: string) => Promise<ResultadoLimite>;

export function crearLimitadorUpstash(url: string, token: string): Limitador {
  const limite = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(PETICIONES_POR_MINUTO, "1 m"),
    prefix: "playa-hoy",
    // Pasado este tiempo sin respuesta, Upstash da la petición por permitida
    timeout: ESPERA_MAXIMA_MS,
  });
  return async (clave) => {
    const r = await limite.limit(clave);
    return { permitido: r.success, limite: r.limit, restantes: r.remaining, reinicio: r.reset };
  };
}

// Ventana fija de un minuto en memoria: para los tests y para probar en local. No sirve con
// varias instancias, que no comparten la memoria.
export function crearLimitadorEnMemoria({
  porMinuto = PETICIONES_POR_MINUTO,
  reloj = () => new Date(),
} = {}): Limitador {
  const cuentas = new Map<string, { ventana: number; peticiones: number }>();
  return (clave) => {
    const ventana = Math.floor(reloj().getTime() / MINUTO_MS);
    const actual = cuentas.get(clave);
    const peticiones = actual?.ventana === ventana ? actual.peticiones + 1 : 1;
    cuentas.set(clave, { ventana, peticiones });
    return Promise.resolve({
      permitido: peticiones <= porMinuto,
      limite: porMinuto,
      restantes: Math.max(0, porMinuto - peticiones),
      reinicio: (ventana + 1) * MINUTO_MS,
    });
  };
}

// La IP de quien llama. En Vercel, x-forwarded-for lo pone la plataforma con la IP real del
// cliente en primer lugar; detrás de otro proxy habría que revisar en quién se confía.
const ipDe = (cabecera: (nombre: string) => string | undefined) =>
  cabecera("x-forwarded-for")?.split(",")[0]?.trim() || cabecera("x-real-ip") || "desconocida";

// No cuenta: comprobar que la API vive no debe gastar cupo
const SIN_LIMITE = new Set(["/v1/estado"]);

export function limitarPeticiones(limitador: Limitador, { reloj = () => new Date() } = {}) {
  return createMiddleware(async (c, next) => {
    if (SIN_LIMITE.has(c.req.path)) return next();

    let resultado: ResultadoLimite;
    try {
      resultado = await limitador(ipDe((nombre) => c.req.header(nombre)));
    } catch (error) {
      console.error("Límite de peticiones no disponible: la petición pasa sin límite", error);
      return next();
    }

    const segundos = Math.max(0, Math.ceil((resultado.reinicio - reloj().getTime()) / 1000));
    c.header("RateLimit-Limit", resultado.limite.toString());
    c.header("RateLimit-Remaining", resultado.restantes.toString());
    c.header("RateLimit-Reset", segundos.toString());
    if (!resultado.permitido) {
      c.header("Retry-After", segundos.toString());
      return c.json(
        cuerpoError(
          "demasiadas_peticiones",
          `Demasiadas peticiones: como mucho ${resultado.limite.toString()} por minuto. Vuelve a intentarlo en ${segundos.toString()} s`,
        ),
        429,
      );
    }
    return next();
  });
}
