import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pedirJson } from "./red.ts";

// Servidor local con una ruta por caso. Sin red.
let servidor: Server;
let base = "";
const llamadas = new Map<string, number>();
const agentes: string[] = [];

const rutas: Record<string, (n: number, res: ServerResponse) => void> = {
  "/bien": (_, res) => res.writeHead(200).end('{"ok":true}'),
  // Falla la primera vez y responde la segunda
  "/fallo-puntual": (n, res) =>
    n === 1 ? res.writeHead(500).end() : res.writeHead(200).end('{"ok":2}'),
  "/limite": (n, res) => (n === 1 ? res.writeHead(429).end() : res.writeHead(200).end('{"ok":3}')),
  "/caido": (_, res) => res.writeHead(503).end(),
  "/no-existe": (_, res) => res.writeHead(404).end(),
  // "Meteorología" en ISO-8859-15, como responde AEMET
  "/latin": (_, res) => res.writeHead(200).end(Buffer.from('{"t":"Meteorología"}', "latin1")),
};

beforeAll(async () => {
  servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
    const ruta = req.url ?? "";
    const n = (llamadas.get(ruta) ?? 0) + 1;
    llamadas.set(ruta, n);
    agentes.push(req.headers["user-agent"] ?? "");
    rutas[ruta]?.(n, res);
  });
  await new Promise<void>((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const direccion = servidor.address();
  base = typeof direccion === "object" && direccion ? `http://127.0.0.1:${direccion.port}` : "";
});

afterAll(() => {
  servidor.close();
});

const rapido = { esperaMs: 1, esperaTrasLimiteMs: 1 };

describe("pedirJson", () => {
  it("devuelve el JSON y se identifica con User-Agent", async () => {
    expect(await pedirJson(`${base}/bien`, rapido)).toEqual({ ok: true });
    expect(agentes.at(-1)).toMatch(/playa-hoy/);
  });

  it("reintenta tras un fallo puntual", async () => {
    expect(await pedirJson(`${base}/fallo-puntual`, rapido)).toEqual({ ok: 2 });
  });

  it("ante un 429 espera el tiempo de límite antes de reintentar", async () => {
    const inicio = Date.now();

    expect(await pedirJson(`${base}/limite`, { esperaMs: 1, esperaTrasLimiteMs: 150 })).toEqual({
      ok: 3,
    });
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(140);
  });

  it("decodifica la codificación indicada", async () => {
    expect(await pedirJson(`${base}/latin`, { codificacion: "iso-8859-15" })).toEqual({
      t: "Meteorología",
    });
  });

  it("no repite una petición que falla por un error suyo (4xx)", async () => {
    await expect(pedirJson(`${base}/no-existe`, rapido)).rejects.toThrow(
      /falló \(intento 1: HTTP 404\)$/,
    );
    expect(llamadas.get("/no-existe")).toBe(1);
    await expect(pedirJson(`${base}/no-existe`, rapido)).rejects.toMatchObject({ estado: 404 });
  });

  it("si falla en todos los intentos, lo dice con el detalle de cada uno", async () => {
    await expect(pedirJson(`${base}/caido`, { ...rapido, intentos: 2 })).rejects.toThrow(
      /falló \(intento 1: HTTP 503; intento 2: HTTP 503\)/,
    );
  });
});
