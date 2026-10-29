// Piezas comunes de las rutas
import { z } from "@hono/zod-openapi";

// Orden alfabético en español, en la API y no en SQL: la intercalación de la base de datos
// puede cambiar entre servidores, y "Águilas" no debe ir detrás de la "Z"
const alfabetico = new Intl.Collator("es");
export const porNombre = <T extends { nombre: string }>(a: T, b: T) =>
  alfabetico.compare(a.nombre, b.nombre);

// Las listas van envueltas en { datos: [...] }: así se pueden añadir campos (paginación…)
// sin romper a quien ya use la API
export const lista = <T extends z.ZodType>(esquemaElemento: T) =>
  z.object({ datos: z.array(esquemaElemento) });
