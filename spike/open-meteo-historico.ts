// Spike fase 0 · paso 4: ¿qué variables y qué años cubre el histórico de Open-Meteo?
// Ejecutar con: node spike/open-meteo-historico.ts
// Prueba cada API y modelo con un día de distintas épocas y cuenta los huecos.

import { mkdir, writeFile } from "node:fs/promises";

// Cabo de Palos: mar abierto, la celda marina queda cerca de la costa.
const punto = { lat: 37.633, lon: -0.692 };

const marinas = ["wave_height", "wave_direction", "wave_period", "sea_surface_temperature"];
const tiempo = ["wind_speed_10m", "wind_direction_10m", "temperature_2m", "cloud_cover"];

const hoy = new Date();
const haceDias = (n: number) => new Date(hoy.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const fechas = ["1940-07-15", "1960-07-15", "1980-07-15", "2000-07-15", "2015-07-15", "2021-07-15", "2022-07-15", "2023-07-15", "2024-07-15", haceDias(30), haceDias(7), haceDias(3)];

const pruebas = [
  // Reanálisis: reconstrucción del tiempo pasado con observaciones (no es una previsión).
  { nombre: "archive (reanálisis, por defecto)", url: "https://archive-api.open-meteo.com/v1/archive", vars: tiempo },
  { nombre: "archive era5", url: "https://archive-api.open-meteo.com/v1/archive", vars: tiempo, modelo: "era5" },
  { nombre: "marine (por defecto)", url: "https://marine-api.open-meteo.com/v1/marine", vars: marinas },
  { nombre: "marine era5_ocean", url: "https://marine-api.open-meteo.com/v1/marine", vars: marinas, modelo: "era5_ocean" },
  { nombre: "marine ecmwf_wam025", url: "https://marine-api.open-meteo.com/v1/marine", vars: marinas, modelo: "ecmwf_wam025" },
  { nombre: "marine meteofrance_wave", url: "https://marine-api.open-meteo.com/v1/marine", vars: marinas, modelo: "meteofrance_wave" },
  // Previsiones antiguas archivadas: lo que se predijo, útil para medir la fiabilidad (fase 12).
  { nombre: "historical-forecast", url: "https://historical-forecast-api.open-meteo.com/v1/forecast", vars: tiempo },
];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

await mkdir("spike/datos/historico", { recursive: true });

for (const p of pruebas) {
  console.log(`\n=== ${p.nombre} ===`);
  for (const fecha of fechas) {
    const params = new URLSearchParams({
      latitude: String(punto.lat),
      longitude: String(punto.lon),
      start_date: fecha,
      end_date: fecha,
      hourly: p.vars.join(","),
      timezone: "UTC",
      ...(p.modelo && { models: p.modelo }),
    });
    const res = await fetch(`${p.url}?${params}`);
    const json = await res.json();
    if (!res.ok) {
      console.log(`  ${fecha}  ERROR ${res.status}: ${json.reason}`);
    } else {
      const huecos = p.vars.map((v) => {
        const valores: (number | null)[] = json.hourly[v];
        const nulos = valores.filter((x) => x === null).length;
        return nulos === 0 ? `${v}=ok` : nulos === valores.length ? `${v}=VACÍO` : `${v}=${nulos}/24 nulos`;
      });
      console.log(`  ${fecha}  celda ${json.latitude}, ${json.longitude}  ${huecos.join("  ")}`);
      await writeFile(`spike/datos/historico/${p.nombre.replace(/\W+/g, "_")}-${fecha}.json`, JSON.stringify(json));
    }
    await esperar(300);
  }
}
