// Un solo formato para todos los errores de la API:
//   { "error": { "codigo": "...", "mensaje": "...", "detalles": [...] } }
// El código es estable (para programar contra él); el mensaje, en español, para personas.
import { OpenAPIHono, z } from "@hono/zod-openapi";

const CODIGOS = [
  "parametro_no_valido",
  "no_encontrado",
  "ruta_no_existe",
  "error_interno",
] as const;
type Codigo = (typeof CODIGOS)[number];

const EsquemaDetalle = z.object({
  campo: z.string().openapi({ example: "lat" }),
  en: z.string().openapi({ description: "Dónde va el parámetro: query o param", example: "query" }),
  mensaje: z.string().openapi({ example: "Demasiado grande: se esperaba que number fuera <=90" }),
});

export const EsquemaError = z
  .object({
    error: z.object({
      codigo: z.enum(CODIGOS),
      mensaje: z.string(),
      detalles: z
        .array(EsquemaDetalle)
        .optional()
        .openapi({ description: "En parametro_no_valido: qué parámetro falla y por qué" }),
    }),
  })
  .openapi("Error");

export const respuestaError = (descripcion: string) => ({
  description: descripcion,
  content: { "application/json": { schema: EsquemaError } },
});

type Detalle = z.infer<typeof EsquemaDetalle>;

export const cuerpoError = (codigo: Codigo, mensaje: string, detalles?: Detalle[]) => ({
  error: detalles === undefined ? { codigo, mensaje } : { codigo, mensaje, detalles },
});

// Todas las rutas se crean con este router: un parámetro que no cumple su esquema responde
// 400 con el formato común, con un detalle por problema (los mensajes de Zod, en español).
// Si el parámetro falta, "Obligatorio": si no, un número que falta llegaría como NaN y una
// lista cerrada diría "opción inválida", mensajes que confunden.
export function crearRouter() {
  return new OpenAPIHono({
    defaultHook: (resultado, c) => {
      if (resultado.success) return undefined;
      const enviados: Record<string, string | undefined> =
        resultado.target === "query"
          ? c.req.query()
          : resultado.target === "param"
            ? c.req.param()
            : {};
      const detalles = resultado.error.issues.map((problema) => {
        const campo = problema.path.join(".") || "(entero)";
        // Si no se envió y tiene un problema, es que es obligatorio
        const falta = enviados[campo] === undefined;
        return { campo, en: resultado.target, mensaje: falta ? "Obligatorio" : problema.message };
      });
      return c.json(cuerpoError("parametro_no_valido", "Hay parámetros no válidos", detalles), 400);
    },
  });
}
