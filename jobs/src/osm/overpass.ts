// Cliente mínimo de Overpass (la API de consulta de OpenStreetMap).
// El servidor principal responde 502 a menudo: se prueban varios servidores espejo y se
// reintenta con espera creciente.
import { z } from "zod";

const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Overpass exige identificarse; sin User-Agent responde 406
const USER_AGENT = "playa-hoy (https://github.com/pdawgabriel-hub/playa-hoy)";

const esquemaRespuesta = z.object({
  elements: z.array(
    z.object({
      type: z.enum(["node", "way", "relation"]),
      id: z.number(),
      tags: z.record(z.string(), z.string()).optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
      geometry: z.array(z.object({ lat: z.number(), lon: z.number() }).nullable()).optional(),
      members: z
        .array(
          z.object({
            type: z.string(),
            role: z.string(),
            geometry: z.array(z.object({ lat: z.number(), lon: z.number() }).nullable()).optional(),
          }),
        )
        .optional(),
    }),
  ),
});

export type ElementoOsm = z.infer<typeof esquemaRespuesta>["elements"][number];

type Opciones = {
  servidores?: string[];
  intentos?: number;
  esperaMs?: number;
  timeoutMs?: number;
};

export async function consultarOverpass(consulta: string, opciones: Opciones = {}) {
  const { servidores = SERVIDORES, intentos = 3, esperaMs = 5000, timeoutMs = 180_000 } = opciones;
  const errores: string[] = [];

  for (let intento = 1; intento <= intentos; intento++) {
    for (const servidor of servidores) {
      try {
        const respuesta = await fetch(servidor, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ data: consulta }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        return esquemaRespuesta.parse(await respuesta.json()).elements;
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        errores.push(`${servidor} (intento ${intento}): ${mensaje}`);
      }
    }
    if (intento < intentos) await new Promise((r) => setTimeout(r, esperaMs * intento));
  }
  throw new Error(`Overpass no respondió:\n${errores.join("\n")}`);
}
