// Extrae del censo de aguas de baño las zonas de la Región de Murcia y las guarda en
// jobs/datos/censo-<año>-murcia.json, tal como vienen (sin limpiar nombres).
//
// El censo se descarga a mano una vez al año (la descarga tiene captcha) desde
// https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/agua/censo-aguas-bano.html
// Se descomprime y se pasa la carpeta que contiene ProtectedAreaPoint.dbf y .shp:
//   pnpm --filter @playa-hoy/jobs extraer:censo ~/Descargas/censoaguasbano_2025
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { leerDbf, leerPuntosShp } from "./shapefile.ts";

const carpeta = process.argv[2];
if (!carpeta) throw new Error("Indica la carpeta del censo descomprimido");

const base = join(carpeta, "ProtectedAreaPoint", "ProtectedAreaPoint");
const registros = leerDbf(await readFile(`${base}.dbf`));
const puntos = leerPuntosShp(await readFile(`${base}.shp`));
if (registros.length !== puntos.length) {
  throw new Error(`El .dbf tiene ${registros.length} registros y el .shp ${puntos.length} puntos`);
}

const temporada = registros[0]?.cYear;
const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

const zonas = registros
  .map((r, i) => ({ registro: r, punto: puntos[i] }))
  // ES620 es la Región de Murcia (código NUTS)
  .filter(({ registro }) => registro.localId?.startsWith("ES620"))
  .map(({ registro, punto }) => ({
    codigo: registro.localId,
    // nameTxtInt: el nombre sin tildes, que nunca llega roto (nameText trae "CARRI?N")
    nombre: registro.nameTxtInt,
    tipo: registro.spZoneType,
    lat: redondear(punto?.lat ?? Number.NaN),
    lon: redondear(punto?.lon ?? Number.NaN),
  }))
  .toSorted((a, b) => (a.codigo ?? "").localeCompare(b.codigo ?? ""));

const destino = new URL(`../../datos/censo-${temporada}-murcia.json`, import.meta.url);
const fuente =
  "Censo de zonas de aguas de baño (Ministerio de Sanidad, publicado por MITECO). Uso libre citando al Ministerio.";
await writeFile(
  destino,
  `${JSON.stringify({ fuente, temporada: Number(temporada), zonas }, null, 2)}\n`,
);
console.log(
  `Censo ${temporada}: ${zonas.length} zonas de la Región de Murcia -> ${destino.pathname}`,
);
