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

  for (let intento = 1; intento <= intentos; intento++) {
    let limite = false;
    try {
      const respuesta = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, ...cabeceras },
        signal: AbortSignal.timeout(timeoutMs),
      });
      limite = respuesta.status === 429;
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return JSON.parse(new TextDecoder(codificacion).decode(await respuesta.arrayBuffer()));
    } catch (error) {
      errores.push(`intento ${intento}: ${error instanceof Error ? error.message : String(error)}`);
      if (intento < intentos) await esperar(limite ? esperaTrasLimiteMs : esperaMs * intento);
    }
  }
  throw new Error(`${new URL(url).host} no respondió (${errores.join("; ")})`);
}
