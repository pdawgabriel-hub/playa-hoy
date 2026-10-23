// Peticiones HTTP de los jobs: con tiempo límite, identificación y reintentos con espera
// creciente. Un fallo puntual de una API no debe tumbar la ingesta.

export const USER_AGENT = "playa-hoy (https://github.com/pdawgabriel-hub/playa-hoy)";

export type OpcionesRed = {
  intentos?: number;
  esperaMs?: number;
  // Si la API responde 429 (demasiadas peticiones), se espera más antes de reintentar.
  // AEMET corta a partir de unas 40 peticiones por minuto.
  esperaTrasLimiteMs?: number;
  timeoutMs?: number;
  cabeceras?: Record<string, string>;
  // AEMET responde en ISO-8859-15: leído como UTF-8, las tildes salen rotas
  codificacion?: string;
};

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

// Un 4xx es un error de la petición (clave mala, recurso que no existe): repetirla no lo
// arregla. Se exceptúan 408 (tiempo agotado) y 429 (demasiadas peticiones), que son pasajeros.
const sinArreglo = (estado: number) =>
  estado >= 400 && estado < 500 && ![408, 429].includes(estado);

// Error tras agotar los intentos. `estado` es el código HTTP del último, si llegó a responder.
export class ErrorRed extends Error {
  readonly estado: number | undefined;
  constructor(mensaje: string, estado: number | undefined) {
    super(mensaje);
    this.name = "ErrorRed";
    this.estado = estado;
  }
}

export async function pedirJson(url: string, opciones: OpcionesRed = {}): Promise<unknown> {
  const {
    intentos = 3,
    esperaMs = 2000,
    esperaTrasLimiteMs = 60_000,
    timeoutMs = 60_000,
    cabeceras = {},
    codificacion = "utf-8",
  } = opciones;
  const errores: string[] = [];
  let estado: number | undefined;

  for (let intento = 1; intento <= intentos; intento++) {
    let limite = false;
    let definitivo = false;
    try {
      const respuesta = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, ...cabeceras },
        signal: AbortSignal.timeout(timeoutMs),
      });
      estado = respuesta.status;
      limite = respuesta.status === 429;
      definitivo = sinArreglo(respuesta.status);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return JSON.parse(new TextDecoder(codificacion).decode(await respuesta.arrayBuffer()));
    } catch (error) {
      errores.push(`intento ${intento}: ${error instanceof Error ? error.message : String(error)}`);
      if (definitivo) break;
      if (intento < intentos) await esperar(limite ? esperaTrasLimiteMs : esperaMs * intento);
    }
  }
  throw new ErrorRed(`${new URL(url).host} falló (${errores.join("; ")})`, estado);
}
