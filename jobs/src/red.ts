// Peticiones HTTP de los jobs: con tiempo límite, identificación y reintentos con espera
// creciente. Un fallo puntual de una API no debe tumbar la ingesta.

export const USER_AGENT = "playa-hoy (https://github.com/pdawgabriel-hub/playa-hoy)";

export type OpcionesRed = {
  intentos?: number;
  esperaMs?: number;
  timeoutMs?: number;
  cabeceras?: Record<string, string>;
};

export async function pedirJson(url: string, opciones: OpcionesRed = {}): Promise<unknown> {
  const { intentos = 3, esperaMs = 2000, timeoutMs = 60_000, cabeceras = {} } = opciones;
  const errores: string[] = [];

  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const respuesta = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, ...cabeceras },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return await respuesta.json();
    } catch (error) {
      errores.push(`intento ${intento}: ${error instanceof Error ? error.message : String(error)}`);
      if (intento < intentos) await new Promise((r) => setTimeout(r, esperaMs * intento));
    }
  }
  throw new Error(`${new URL(url).host} no respondió (${errores.join("; ")})`);
}
