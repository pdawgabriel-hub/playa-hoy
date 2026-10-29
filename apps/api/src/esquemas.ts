// Esquemas de respuesta que comparten varias rutas
import { z } from "@hono/zod-openapi";

export const EsquemaPlayaBreve = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    slug: z.string(),
    municipio: z.object({ id: z.string(), nombre: z.string(), slug: z.string() }),
    zona: z.object({ id: z.number().int(), nombre: z.string(), slug: z.string() }).nullable(),
    laguna: z.boolean(),
  })
  .openapi("PlayaBreve");

export const EsquemaRazon = z
  .object({
    tipo: z.enum(["descarta", "en_contra", "a_favor"]),
    factor: z.string().openapi({ example: "ola" }),
    texto: z.string().openapi({ example: "Poca ola en la orilla (0,1 m)" }),
  })
  .openapi("Razon");

export const EsquemaNota = z
  .object({
    nota: z.number().int().min(0).max(100),
    razones: z.array(EsquemaRazon),
  })
  .openapi("Nota");

const PLANES = {
  familia: "Familia con niños",
  snorkel: "Snorkel",
  sol: "Tomar el sol",
  surf: "Surf",
} as const;

// Un valor por plan: { familia, snorkel, sol, surf }
export const porPlan = <T extends z.ZodType>(esquema: T) =>
  z.object({
    familia: esquema.openapi({ description: PLANES.familia }),
    snorkel: esquema.openapi({ description: PLANES.snorkel }),
    sol: esquema.openapi({ description: PLANES.sol }),
    surf: esquema.openapi({ description: PLANES.surf }),
  });

export const EsquemaFranja = z
  .object({
    inicio: z.string().openapi({ description: "UTC", example: "2026-07-15T09:00:00.000Z" }),
    fin: z.string().openapi({ example: "2026-07-15T12:00:00.000Z" }),
    inicioLocal: z.string().openapi({ description: "Hora de España", example: "11:00" }),
    finLocal: z.string().openapi({ example: "14:00" }),
    nota: z.number().int().min(1).max(100).openapi({ description: "Media de las tres horas" }),
  })
  .openapi("Franja");

export const EsquemaHora = z
  .object({
    hora: z.string().openapi({ description: "UTC", example: "2026-07-15T10:00:00.000Z" }),
    horaLocal: z.string().openapi({ description: "Hora de España", example: "12:00" }),
    deDia: z.boolean().openapi({
      description: "Si la hora entera es de día. Las notas de noche no sirven para ir a la playa",
    }),
    olaOrilla: z.number().nullable().openapi({ description: "Ola en la orilla, en m" }),
    olaPeriodo: z.number().nullable().openapi({ description: "s" }),
    viento: z.object({
      velocidad: z.number().nullable().openapi({ description: "km/h" }),
      racha: z.number().nullable().openapi({ description: "km/h" }),
      direccion: z.number().nullable().openapi({ description: "Grados de los que viene" }),
      nombre: z.string().nullable().openapi({ example: "levante" }),
      entrada: z.enum(["mar", "lado", "tierra", "calma"]).nullable(),
    }),
    temperaturaAire: z.number().nullable(),
    temperaturaAgua: z.number().nullable(),
    fuenteTemperaturaAgua: z.enum(["open_meteo", "aemet"]).nullable(),
    nubosidad: z.number().nullable().openapi({ description: "% de cielo cubierto" }),
    claridad: z.number().nullable().openapi({ description: "De 1 (agua quieta) a 0" }),
    estadoAgua: z.enum(["cristalina", "buena", "turbia"]).nullable(),
    bandera: z.enum(["verde", "amarilla", "roja"]).nullable().openapi({
      description:
        "Bandera probable: una estimación, la iza el socorrista. Nula si la playa no tiene socorrista o no se sabe.",
    }),
    notas: porPlan(EsquemaNota.nullable()),
  })
  .openapi("Hora");
