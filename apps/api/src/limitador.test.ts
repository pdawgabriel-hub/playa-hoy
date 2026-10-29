import { crearDb } from "@playa-hoy/db";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { crearApp } from "./app.ts";
import { type Limitador, crearLimitadorEnMemoria } from "./limitador.ts";

// Las rutas de estado y de la especificación no consultan la base de datos
const db = crearDb("postgresql://sin-conexion@localhost:1/ninguna").db;
const AHORA = new Date("2026-07-15T10:00:20Z");

const conLimite = (limitador: Limitador) => crearApp(db, { reloj: () => AHORA, limitador });
const desde = (ip: string) => ({ headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

// /v1/no-existe pasa por el limitador y responde rápido sin base de datos
const RUTA = "/v1/no-existe";

describe("límite de peticiones por IP", () => {
  it("deja pasar hasta el límite y después responde 429 con Retry-After", async () => {
    const app = conLimite(crearLimitadorEnMemoria({ porMinuto: 3, reloj: () => AHORA }));
    const estados = [];
    for (let i = 0; i < 4; i++) estados.push((await app.request(RUTA, desde("1.1.1.1"))).status);

    expect(estados).toEqual([404, 404, 404, 429]);
    const res = await app.request(RUTA, desde("1.1.1.1"));
    // Quedan 40 s para el minuto siguiente
    expect(res.headers.get("Retry-After")).toBe("40");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(
      z
        .object({ error: z.object({ codigo: z.string(), mensaje: z.string() }) })
        .parse(await res.json()),
    ).toEqual({
      error: {
        codigo: "demasiadas_peticiones",
        mensaje: "Demasiadas peticiones: como mucho 3 por minuto. Vuelve a intentarlo en 40 s",
      },
    });
  });

  it("cuenta por IP: otra IP tiene su propio cupo", async () => {
    const app = conLimite(crearLimitadorEnMemoria({ porMinuto: 1, reloj: () => AHORA }));

    expect((await app.request(RUTA, desde("1.1.1.1"))).status).toBe(404);
    expect((await app.request(RUTA, desde("1.1.1.1"))).status).toBe(429);
    expect((await app.request(RUTA, desde("2.2.2.2"))).status).toBe(404);
  });

  it("cada respuesta dice el límite, lo que queda y cuándo se recupera", async () => {
    const app = conLimite(crearLimitadorEnMemoria({ porMinuto: 60, reloj: () => AHORA }));
    const res = await app.request(RUTA, desde("3.3.3.3"));

    expect(res.headers.get("RateLimit-Limit")).toBe("60");
    expect(res.headers.get("RateLimit-Remaining")).toBe("59");
    expect(res.headers.get("RateLimit-Reset")).toBe("40");
  });

  it("comprobar el estado no gasta cupo, ni la especificación (fuera de /v1)", async () => {
    const limitador = vi.fn(crearLimitadorEnMemoria({ porMinuto: 1, reloj: () => AHORA }));
    const app = conLimite(limitador);

    for (let i = 0; i < 3; i++) {
      expect((await app.request("/v1/estado", desde("4.4.4.4"))).status).toBe(200);
      expect((await app.request("/openapi.json", desde("4.4.4.4"))).status).toBe(200);
    }
    expect(limitador).not.toHaveBeenCalled();
  });

  it("si el limitador falla, la petición pasa y se registra", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = conLimite(() => Promise.reject(new Error("Upstash no responde")));

    expect((await app.request(RUTA, desde("5.5.5.5"))).status).toBe(404);
    expect(registro).toHaveBeenCalledWith(
      expect.stringMatching(/pasa sin límite/),
      expect.any(Error),
    );
    registro.mockRestore();
  });

  it("sin limitador, no hay límite ni cabeceras de límite", async () => {
    const app = crearApp(db, { reloj: () => AHORA });
    const res = await app.request(RUTA, desde("6.6.6.6"));

    expect(res.status).toBe(404);
    expect(res.headers.get("RateLimit-Limit")).toBeNull();
  });
});
