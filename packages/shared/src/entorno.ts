import { z } from "zod";

// Un esquema por grupo de variables: cada app valida al arrancar solo las que usa.

export const esquemaBaseDatos = z.object({
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    // Neon la añade a sus URLs, pero el driver postgres la manda al servidor como si fuera
    // un ajuste y la conexión falla con un error confuso
    .refine((url) => !/[?&]channel_binding=/.test(url), {
      message: "quita channel_binding de la URL: el driver postgres no lo admite",
    }),
});

export const esquemaAemet = z.object({
  AEMET_API_KEY: z.string().min(1),
});

export const esquemaServidor = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

type Origen = Record<string, string | undefined>;

// Recibe las variables como parámetro (normalmente process.env) para no depender de Node
// y poder probarla sin tocar el entorno real.
export function leerEntorno<T extends z.ZodType>(esquema: T, origen: Origen): z.infer<T> {
  const resultado = esquema.safeParse(origen);
  if (!resultado.success) {
    throw new Error(`Variables de entorno no válidas:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
