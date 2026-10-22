// Spike fase 0 · paso 2: ¿qué da la predicción de playas de AEMET OpenData?
// Ejecutar con: node --env-file=.env spike/aemet.ts
// Guarda el listado y las predicciones en spike/datos/aemet/ e imprime un resumen.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

const API = "https://opendata.aemet.es/opendata/api";
const CSV_PLAYAS = "https://www.aemet.es/documentos/es/eltiempo/prediccion/playas/Playas_codigos.csv";

const clave = process.env.AEMET_API_KEY;
if (!clave) throw new Error("Falta AEMET_API_KEY en .env");

// AEMET responde en ISO-8859-15, no en UTF-8.
async function texto(url: string, cabeceras: Record<string, string> = {}) {
  const res = await fetch(url, { headers: cabeceras });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return new TextDecoder("iso-8859-15").decode(await res.arrayBuffer());
}

// "37º 22' 36"" → 37.3767
function gradosDecimales(dms: string) {
  const [g, m, s] = dms.match(/\d+/g)!.map(Number);
  return (dms.startsWith("-") ? -1 : 1) * (g + m / 60 + s / 3600);
}

// La API no da los datos directamente: devuelve una URL temporal donde están.
async function prediccion(idPlaya: string) {
  const sobre = JSON.parse(await texto(`${API}/prediccion/especifica/playa/${idPlaya}`, { api_key: clave! }));
  if (sobre.estado !== 200) throw new Error(`${idPlaya}: ${sobre.estado} ${sobre.descripcion}`);
  return JSON.parse(await texto(sobre.datos));
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

await mkdir("spike/datos/aemet", { recursive: true });

const filas = (await texto(CSV_PLAYAS)).trim().split(/\r?\n/).slice(1).map((l) => l.split(";"));
const playas = filas
  .filter((f) => f[2] === "30")
  .map(([id, nombre, , , , municipio, lat, lon]) => ({
    id,
    nombre,
    municipio,
    lat: gradosDecimales(lat),
    lon: gradosDecimales(lon),
  }));
await writeFile("spike/datos/aemet/playas-murcia.json", JSON.stringify(playas, null, 2));

console.log(`Playas de Murcia con predicción AEMET: ${playas.length}`);
const porMunicipio = Object.groupBy(playas, (p) => p.municipio);
for (const [m, ps] of Object.entries(porMunicipio)) console.log(`  ${m}: ${ps!.length}`);

// Cada playa son 2 peticiones. Tras ~40 en un minuto AEMET responde 429:
// entonces se espera un minuto y se reintenta. Las ya descargadas se saltan.
let errores = 0;
for (const playa of playas) {
  const fichero = `spike/datos/aemet/${playa.id}.json`;
  if (existsSync(fichero)) continue;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const datos = await prediccion(playa.id);
      await writeFile(fichero, JSON.stringify(datos, null, 2));
      break;
    } catch (e) {
      const mensaje = (e as Error).message;
      if (mensaje.includes("HTTP 429") && intento < 3) {
        console.log(`  429 en ${playa.nombre}, esperando 60 s`);
        await esperar(60_000);
        continue;
      }
      errores++;
      console.log(`  ERROR ${playa.nombre}: ${mensaje}`);
      break;
    }
  }
  await esperar(1500);
}
console.log(`\nPredicciones descargadas: ${playas.length - errores}/${playas.length}`);
