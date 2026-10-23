// Open-Meteo simulada con MSW. Responde con respuestas reales (23/10/2026, dos puntos de
// La Manga y el Mar Menor, 24 horas): sirve para dos puntos de consulta cualesquiera.
import { HttpResponse, http } from "msw";

import tiempo from "../open-meteo/pruebas/forecast-tiempo-dos-puntos.json" with { type: "json" };
import viento from "../open-meteo/pruebas/forecast-viento-dos-puntos.json" with { type: "json" };
import marina from "../open-meteo/pruebas/marine-dos-puntos.json" with { type: "json" };
import { redSimulada } from "./red.ts";

// Primera y última hora de las respuestas
export const PRIMERA_HORA = new Date("2026-10-23T00:00:00Z");
export const ULTIMA_HORA = new Date("2026-10-23T23:00:00Z");

type Opciones = {
  // Código HTTP con el que falla cada API; sin indicar, responden bien
  marineFalla?: number;
  forecastFalla?: number;
};

// Devuelve las URLs pedidas
export function simularOpenMeteo({ marineFalla, forecastFalla }: Opciones = {}) {
  const urls: URL[] = [];
  redSimulada.use(
    http.get("https://marine-api.open-meteo.com/v1/marine", ({ request }) => {
      urls.push(new URL(request.url));
      return marineFalla
        ? new HttpResponse(null, { status: marineFalla })
        : HttpResponse.json(marina);
    }),
    // El viento se pide a la celda de mar y la temperatura y las nubes a la de tierra
    http.get("https://api.open-meteo.com/v1/forecast", ({ request }) => {
      const url = new URL(request.url);
      urls.push(url);
      if (forecastFalla) return new HttpResponse(null, { status: forecastFalla });
      return HttpResponse.json(url.searchParams.get("cell_selection") === "sea" ? viento : tiempo);
    }),
  );
  return urls;
}
