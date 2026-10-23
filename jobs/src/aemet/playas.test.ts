import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { consultarPlayasAemet, leerPrediccionPlaya } from "./playas.ts";

// Respuesta real de AEMET (23/10/2026) para Paseo de Manzanares (3090206), en ISO-8859-15,
// tal como llega
const BRUTO = readFileSync(new URL("./pruebas/playa-3090206.json", import.meta.url));
const DATOS: unknown = JSON.parse(new TextDecoder("iso-8859-15").decode(BRUTO));

describe("leerPrediccionPlaya", () => {
  const prediccion = leerPrediccionPlaya(DATOS);

  it("lee los tres días con fechas en formato ISO", () => {
    expect(prediccion.nombre).toBe("Manzanares");
    expect(prediccion.dias.map((d) => d.fecha)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]);
  });

  it("pasa la hora de elaboración, en hora de España, a UTC", () => {
    expect(prediccion.elaborado).toEqual(new Date("2026-10-23T06:51:16Z"));
  });

  it("da la temperatura del agua, la máxima y el UV de cada día", () => {
    const [hoy] = prediccion.dias;

    expect(typeof hoy?.temperaturaAgua).toBe("number");
    expect(typeof hoy?.temperaturaMaxima).toBe("number");
    expect(typeof hoy?.uvMaximo).toBe("number");
  });

  it("da el cielo, el viento y el oleaje de mañana y tarde por categorías", () => {
    expect(Object.keys(prediccion.dias[0]?.oleaje ?? {})).toEqual(["manana", "tarde"]);
  });

  it("rechaza una respuesta con otra forma", () => {
    expect(() => leerPrediccionPlaya([{ nombre: "X" }])).toThrow();
    expect(() => leerPrediccionPlaya([])).toThrow();
  });
});

// AEMET en local: el "sobre" apunta a una URL temporal con los datos, en ISO-8859-15
let servidor: Server;
let base = "";
const claves: (string | undefined)[] = [];
const urls: string[] = [];

beforeAll(async () => {
  servidor = createServer((req, res) => {
    urls.push(req.url ?? "");
    if (req.url?.startsWith("/prediccion/especifica/playa/")) {
      claves.push(req.headers.api_key?.toString());
      const estado = req.url.endsWith("/0000000") ? 404 : 200;
      res.writeHead(200, { "Content-Type": "application/json;charset=ISO-8859-15" });
      res.end(
        JSON.stringify({
          descripcion: estado === 200 ? "exito" : "No hay datos",
          estado,
          datos: `${base}/sh/temporal`,
        }),
      );
    } else if (req.url === "/sh/temporal") {
      res.writeHead(200, { "Content-Type": "text/plain;charset=ISO-8859-15" }).end(BRUTO);
    }
  });
  await new Promise<void>((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const direccion = servidor.address();
  base = typeof direccion === "object" && direccion ? `http://127.0.0.1:${direccion.port}` : "";
});

afterAll(() => {
  servidor.close();
});

describe("consultarPlayasAemet", () => {
  it("sigue los dos pasos y devuelve la predicción de cada playa", async () => {
    const resultado = await consultarPlayasAemet(["3090206", "3001676"], "clave-secreta", {
      base,
      pausaMs: 1,
    });

    expect([...resultado.keys()]).toEqual(["3090206", "3001676"]);
    expect(resultado.get("3090206")?.dias).toHaveLength(3);
  });

  it("manda la clave en la cabecera y nunca en la URL", () => {
    expect(claves.every((c) => c === "clave-secreta")).toBe(true);
    expect(urls.some((u) => u.includes("clave"))).toBe(false);
  });

  it("si AEMET no tiene datos de una playa, lo dice", async () => {
    await expect(consultarPlayasAemet(["0000000"], "clave", { base, intentos: 1 })).rejects.toThrow(
      /404 No hay datos/,
    );
  });
});
