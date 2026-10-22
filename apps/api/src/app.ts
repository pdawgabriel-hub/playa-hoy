import { Hono } from "hono";

// La aplicación se exporta sin arrancar para poder testearla y desplegarla en Vercel.
export const app = new Hono();

app.get("/", (c) => c.json({ nombre: "playa·hoy API", estado: "ok" }));
