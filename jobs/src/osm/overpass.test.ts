import { createServer, type Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { consultarOverpass } from "./overpass.ts";

// Dos servidores locales: uno caído (502) y otro que responde. Sin red.
let caido: Server;
let sano: Server;
let urlCaido = "";
let urlSano = "";
const agentes: string[] = [];

const escuchar = (servidor: Server) =>
  new Promise<string>((resolver) =>
    servidor.listen(0, "127.0.0.1", () => {
      const direccion = servidor.address();
      resolver(
        typeof direccion === "object" && direccion ? `http://127.0.0.1:${direccion.port}/` : "",
      );
    }),
  );

beforeAll(async () => {
  caido = createServer((_, res) => res.writeHead(502).end("Bad Gateway"));
  sano = createServer((req, res) => {
    agentes.push(req.headers["user-agent"] ?? "");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        elements: [{ type: "node", id: 1, lat: 37.6, lon: -0.7, tags: { amenity: "toilets" } }],
      }),
    );
  });
  urlCaido = await escuchar(caido);
  urlSano = await escuchar(sano);
});

afterAll(() => {
  caido.close();
  sano.close();
});

describe("consultarOverpass", () => {
  it("si un servidor falla, prueba el siguiente", async () => {
    const elementos = await consultarOverpass("consulta", {
      servidores: [urlCaido, urlSano],
      esperaMs: 0,
    });

    expect(elementos).toEqual([
      { type: "node", id: 1, lat: 37.6, lon: -0.7, tags: { amenity: "toilets" } },
    ]);
  });

  it("se identifica con User-Agent, que Overpass exige", () => {
    expect(agentes[0]).toMatch(/playa-hoy/);
  });

  it("si fallan todos los intentos, lo dice con el detalle de cada uno", async () => {
    const consulta = consultarOverpass("consulta", {
      servidores: [urlCaido],
      intentos: 2,
      esperaMs: 0,
    });

    await expect(consulta).rejects.toThrow(/intento 1\): HTTP 502[\s\S]*intento 2\): HTTP 502/);
  });
});
