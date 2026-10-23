// Esquemas Zod y tipos compartidos. Sirven para validar y para documentar la API.
import { z } from "zod";

// Mensajes de error de Zod en español en todo el proyecto.
z.config(z.locales.es());

export * from "./entorno.ts";
