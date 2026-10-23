import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { redSimulada } from "../pruebas/red.ts";
import { SERVIDORES, consultarOverpass } from "./overpass.ts";

const ELEMENTOS = [{ type: "node", id: 1, lat: 37.6, lon: -0.7, tags: { amenity: "toilets" } }];

type Peticion = { servidor: string; agente: string; consulta: string | null };

// Cada servidor espejo responde con su código: 200 devuelve ELEMENTOS
function simularServidores(estados: number[]) {
  const peticiones: Peticion[] = [];
  redSimulada.use(
    ...SERVIDORES.map((servidor, i) =>
      http.post(servidor, async ({ request }) => {
        const cuerpo = new URLSearchParams(await request.text());
        peticiones.push({
          servidor,
          agente: request.headers.get("user-agent") ?? "",
          consulta: cuerpo.get("data"),
        });
        const estado = estados[i] ?? 502;
        return estado === 200
          ? HttpResponse.json({ elements: ELEMENTOS })
          : new HttpResponse("Bad Gateway", { status: estado });
      }),
    ),
  );
  return peticiones;
}

describe("consultarOverpass", () => {
  it("si un servidor falla, prueba el siguiente y no sigue cuando uno responde", async () => {
    const peticiones = simularServidores([502, 200, 200]);

    expect(await consultarOverpass("consulta", { esperaMs: 0 })).toEqual(ELEMENTOS);
    expect(peticiones.map((p) => p.servidor)).toEqual(SERVIDORES.slice(0, 2));
  });

  it("manda la consulta en el cuerpo y se identifica con User-Agent, que Overpass exige", async () => {
    const peticiones = simularServidores([200]);
    await consultarOverpass("[out:json];node(1);out;", { esperaMs: 0 });
    const [peticion] = peticiones;

    expect(peticion?.consulta).toBe("[out:json];node(1);out;");
    expect(peticion?.agente).toMatch(/playa-hoy/);
  });

  it("si fallan todos los intentos, lo dice con el detalle de cada uno", async () => {
    simularServidores([502, 502, 502]);

    await expect(consultarOverpass("consulta", { intentos: 2, esperaMs: 0 })).rejects.toThrow(
      /overpass-api\.de.*\(intento 1\): HTTP 502[\s\S]*kumi.*\(intento 2\): HTTP 502/,
    );
  });
});
