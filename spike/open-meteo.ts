// Spike fase 0 · paso 1: ¿qué devuelve Open-Meteo para playas de Murcia?
// Ejecutar con: node spike/open-meteo.ts
// Guarda las respuestas en spike/datos/ e imprime un resumen por playa.

import { mkdir, writeFile } from "node:fs/promises";

// Coordenadas aproximadas, solo para probar. Dos playas del Mar Menor para ver
// si el modelo marino cubre la laguna.
const playas = [
  { nombre: "Los Alcázares (Mar Menor)", lat: 37.744, lon: -0.848 },
  { nombre: "Lo Pagán (Mar Menor)", lat: 37.817, lon: -0.783 },
  { nombre: "La Manga, lado Mediterráneo", lat: 37.652, lon: -0.716 },
  { nombre: "Cabo de Palos, Levante", lat: 37.633, lon: -0.692 },
  { nombre: "Bolnuevo (Mazarrón)", lat: 37.562, lon: -1.305 },
  { nombre: "Águilas, Levante", lat: 37.405, lon: -1.575 },
];

const variablesMarinas = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "wind_wave_height",
  "wind_wave_direction",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "sea_surface_temperature",
];

const variablesTiempo = [
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "temperature_2m",
  "cloud_cover",
];

type Respuesta = {
  latitude: number;
  longitude: number;
  hourly: Record<string, (number | null)[]> & { time: string[] };
  hourly_units: Record<string, string>;
};

const lats = playas.map((p) => p.lat).join(",");
const lons = playas.map((p) => p.lon).join(",");

const consultas = {
  marina: `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&hourly=${variablesMarinas.join(",")}&timezone=UTC&forecast_days=16`,
  // Por defecto Forecast elige la celda de tierra más cercana; probamos también la de mar.
  tiempoTierra: `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=${variablesTiempo.join(",")}&wind_speed_unit=kmh&timezone=UTC&forecast_days=16`,
  tiempoMar: `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=${variablesTiempo.join(",")}&wind_speed_unit=kmh&timezone=UTC&forecast_days=16&cell_selection=sea`,
};

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function descargar(nombre: string, url: string): Promise<Respuesta[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${nombre}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  await writeFile(`spike/datos/open-meteo-${nombre}.json`, JSON.stringify(json, null, 2));
  return Array.isArray(json) ? json : [json];
}

function resumir(titulo: string, respuestas: Respuesta[], variables: string[]) {
  console.log(`\n=== ${titulo} ===`);
  const { time } = respuestas[0].hourly;
  console.log(`Horas: ${time.length} (${time[0]} → ${time.at(-1)})`);
  console.log(`Unidades: ${variables.map((v) => `${v}=${respuestas[0].hourly_units[v]}`).join(", ")}`);

  respuestas.forEach((r, i) => {
    const playa = playas[i];
    const km = distanciaKm(playa.lat, playa.lon, r.latitude, r.longitude).toFixed(1);
    console.log(`\n· ${playa.nombre}: celda ${r.latitude}, ${r.longitude} (a ${km} km)`);

    for (const v of variables) {
      const valores = r.hourly[v];
      const nulos = valores.filter((x) => x === null).length;
      // Última hora con dato: dice hasta dónde llega de verdad la previsión.
      const ultima = valores.findLastIndex((x) => x !== null);
      const estado =
        nulos === valores.length
          ? "SIN DATOS"
          : `${nulos} nulos, con dato hasta ${time[ultima]}, ejemplo ${valores[24]}`;
      console.log(`    ${v.padEnd(24)} ${estado}`);
    }
  });
}

await mkdir("spike/datos", { recursive: true });

const [marina, tiempoTierra, tiempoMar] = await Promise.all([
  descargar("marina", consultas.marina),
  descargar("tiempo-tierra", consultas.tiempoTierra),
  descargar("tiempo-mar", consultas.tiempoMar),
]);

resumir("Marine API", marina, variablesMarinas);
resumir("Forecast API (celda de tierra, por defecto)", tiempoTierra, variablesTiempo);
resumir("Forecast API (cell_selection=sea)", tiempoMar, variablesTiempo);
