// Spike fase 0 · paso 5: ¿qué estaciones de AEMET miden en la costa de Murcia?
// Ejecutar con: node --env-file=.env spike/aemet-observacion.ts
// Descarga las observaciones de las últimas 24 h de todas las estaciones y
// se queda con las cercanas a la costa de Murcia.

import { mkdir, writeFile } from "node:fs/promises";

const API = "https://opendata.aemet.es/opendata/api";
const clave = process.env.AEMET_API_KEY;
if (!clave) throw new Error("Falta AEMET_API_KEY en .env");

async function texto(url: string, cabeceras: Record<string, string> = {}) {
  const res = await fetch(url, { headers: cabeceras });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return new TextDecoder("iso-8859-15").decode(await res.arrayBuffer());
}

const sobre = JSON.parse(await texto(`${API}/observacion/convencional/todas`, { api_key: clave }));
if (sobre.estado !== 200) throw new Error(`${sobre.estado} ${sobre.descripcion}`);
const observaciones: Record<string, unknown>[] = JSON.parse(await texto(sobre.datos));

// Costa de Murcia con algo de margen.
const cerca = observaciones.filter((o) => {
  const lat = o.lat as number;
  const lon = o.lon as number;
  return lat > 37.3 && lat < 38.0 && lon > -1.8 && lon < -0.6;
});

await mkdir("spike/datos/aemet", { recursive: true });
await writeFile("spike/datos/aemet/observacion-murcia.json", JSON.stringify(cerca, null, 2));

const estaciones = Map.groupBy(cerca, (o) => o.idema as string);
console.log(`Observaciones en toda España: ${observaciones.length}. Estaciones en la zona: ${estaciones.size}\n`);

for (const [id, obs] of estaciones) {
  const o = obs.at(-1)!;
  // vv: viento medio (m/s), dv: dirección (grados), vmax: racha, ta: temperatura del aire,
  // tpr: punto de rocío, hr: humedad, prec: lluvia, inso: horas de sol.
  const tiene = ["vv", "dv", "vmax", "ta", "tpr", "hr", "prec", "inso"].filter((k) => o[k] !== undefined);
  console.log(`${id.padEnd(6)} ${String(o.ubi).padEnd(28)} ${(o.lat as number).toFixed(3)}, ${(o.lon as number).toFixed(3)}  alt ${String(o.alt).padStart(4)} m  ${obs.length} obs  [${tiene.join(", ")}]  última ${o.fint}`);
}
console.log("\nClaves de un registro:", Object.keys(cerca[0]).join(", "));
