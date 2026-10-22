// Spike fase 0 · paso 3: ¿qué trae el censo de zonas de aguas de baño 2025?
// El fichero tiene captcha: se descarga a mano desde
// https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/agua/censo-aguas-bano.html
// y se descomprime en spike/datos/censo/.
// Ejecutar con: node spike/censo.ts

import { readFile, writeFile } from "node:fs/promises";

const BASE = "spike/datos/censo/ProtectedAreaPoint/ProtectedAreaPoint";

// Lector mínimo de .dbf: cabecera, descriptores de campo de 32 bytes y registros de ancho fijo.
function leerDbf(buf: Buffer) {
  const numRegistros = buf.readUInt32LE(4);
  const largoCabecera = buf.readUInt16LE(8);
  const largoRegistro = buf.readUInt16LE(10);

  const campos: { nombre: string; tipo: string; largo: number }[] = [];
  for (let pos = 32; buf[pos] !== 0x0d; pos += 32) {
    campos.push({
      nombre: buf.toString("latin1", pos, pos + 11).replace(/\0.*$/, ""),
      tipo: String.fromCharCode(buf[pos + 11]),
      largo: buf[pos + 16],
    });
  }

  const registros: Record<string, string>[] = [];
  for (let i = 0; i < numRegistros; i++) {
    let pos = largoCabecera + i * largoRegistro + 1; // el primer byte marca si está borrado
    const registro: Record<string, string> = {};
    for (const c of campos) {
      registro[c.nombre] = buf.toString("utf8", pos, pos + c.largo).trim();
      pos += c.largo;
    }
    registros.push(registro);
  }
  return { campos, registros };
}

// Lector mínimo de .shp de puntos: cabecera de 100 bytes y, por registro,
// 8 bytes de cabecera + tipo (int32) + x + y (double).
function leerPuntos(buf: Buffer) {
  const puntos: { lon: number; lat: number }[] = [];
  for (let pos = 100; pos < buf.length; ) {
    const largo = buf.readInt32BE(pos + 4) * 2; // en palabras de 16 bits
    puntos.push({ lon: buf.readDoubleLE(pos + 12), lat: buf.readDoubleLE(pos + 20) });
    pos += 8 + largo;
  }
  return puntos;
}

const { campos, registros } = leerDbf(await readFile(`${BASE}.dbf`));
const puntos = leerPuntos(await readFile(`${BASE}.shp`));
const zonas = registros.map((r, i) => ({ ...r, ...puntos[i] }));

console.log(`Zonas en España: ${zonas.length} (puntos en .shp: ${puntos.length})`);
console.log(`\nCampos (${campos.length}):`);
for (const c of campos) {
  const ejemplos = [...new Set(registros.map((r) => r[c.nombre]).filter(Boolean))];
  console.log(`  ${c.nombre.padEnd(11)} ${c.tipo}${String(c.largo).padStart(4)}  ${ejemplos.length} distintos, p. ej. ${ejemplos.slice(0, 3).map((e) => JSON.stringify(e.slice(0, 60))).join(" | ")}`);
}

// Murcia: recuadro aproximado de la costa de la Región.
const murcia = zonas.filter((z) => z.lat > 37.3 && z.lat < 37.9 && z.lon > -1.8 && z.lon < -0.6);
await writeFile("spike/datos/censo/murcia.json", JSON.stringify(murcia, null, 2));
console.log(`\nZonas dentro del recuadro de la costa de Murcia: ${murcia.length}`);
