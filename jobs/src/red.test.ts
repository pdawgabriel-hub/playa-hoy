import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { redSimulada } from "./pruebas/red.ts";
import { pedirJson } from "./red.ts";

const API = "https://api.ejemplo.test";
const rapido = { esperaMs: 1, esperaTrasLimiteMs: 1 };

// Responde con cada respuesta de la lista en orden, una por llamada, y cuenta las llamadas
function secuencia(ruta: string, respuestas: (() => Response)[]) {
  const llamadas = { total: 0 };
  redSimulada.use(
    http.get(`${API}${ruta}`, () => {
      const respuesta = respuestas[Math.min(llamadas.total, respuestas.length - 1)];
      llamadas.total++;
      return respuesta?.() ?? new HttpResponse(null, { status: 500 });
    }),
  );
  return llamadas;
}

const ok = (cuerpo: object) => () => HttpResponse.json(cuerpo);
const estado = (codigo: number) => () => new HttpResponse(null, { status: codigo });

describe("pedirJson", () => {
  it("devuelve el JSON y se identifica con User-Agent", async () => {
    let agente = "";
    redSimulada.use(
      http.get(`${API}/bien`, ({ request }) => {
        agente = request.headers.get("user-agent") ?? "";
        return HttpResponse.json({ ok: true });
      }),
    );

    expect(await pedirJson(`${API}/bien`, rapido)).toEqual({ ok: true });
    expect(agente).toMatch(/playa-hoy/);
  });

  it("reintenta tras un fallo puntual", async () => {
    secuencia("/fallo-puntual", [estado(500), ok({ ok: 2 })]);

    expect(await pedirJson(`${API}/fallo-puntual`, rapido)).toEqual({ ok: 2 });
  });

  it("ante un 429 espera el tiempo de límite antes de reintentar", async () => {
    secuencia("/limite", [estado(429), ok({ ok: 3 })]);
    const inicio = Date.now();

    expect(await pedirJson(`${API}/limite`, { esperaMs: 1, esperaTrasLimiteMs: 150 })).toEqual({
      ok: 3,
    });
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(140);
  });

  it("decodifica la codificación indicada", async () => {
    // "Meteorología" en ISO-8859-15, como responde AEMET
    redSimulada.use(
      http.get(
        `${API}/latin`,
        () => new HttpResponse(Buffer.from('{"t":"Meteorología"}', "latin1")),
      ),
    );

    expect(await pedirJson(`${API}/latin`, { codificacion: "iso-8859-15" })).toEqual({
      t: "Meteorología",
    });
  });

  it("no repite una petición que falla por un error suyo (4xx)", async () => {
    const llamadas = secuencia("/no-existe", [estado(404)]);

    await expect(pedirJson(`${API}/no-existe`, rapido)).rejects.toThrow(
      /falló \(intento 1: HTTP 404\)$/,
    );
    expect(llamadas.total).toBe(1);
    await expect(pedirJson(`${API}/no-existe`, rapido)).rejects.toMatchObject({ estado: 404 });
  });

  it("si falla en todos los intentos, lo dice con el detalle de cada uno", async () => {
    secuencia("/caido", [estado(503)]);

    await expect(pedirJson(`${API}/caido`, { ...rapido, intentos: 2 })).rejects.toThrow(
      /falló \(intento 1: HTTP 503; intento 2: HTTP 503\)/,
    );
  });

  it("un fallo de red también se reintenta", async () => {
    const llamadas = { total: 0 };
    redSimulada.use(
      http.get(`${API}/inestable`, () => {
        llamadas.total++;
        return llamadas.total === 1 ? HttpResponse.error() : HttpResponse.json({ ok: 4 });
      }),
    );

    expect(await pedirJson(`${API}/inestable`, rapido)).toEqual({ ok: 4 });
  });

  it("ningún test sale a la red: una petición sin simular falla", async () => {
    await expect(pedirJson(`${API}/sin-simular`, { ...rapido, intentos: 1 })).rejects.toThrow(
      /falló/,
    );
  });
});
