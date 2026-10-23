// Lector mínimo de shapefiles de puntos, suficiente para el censo de aguas de baño.
// Un shapefile son varios ficheros: .dbf con los atributos y .shp con las geometrías,
// en el mismo orden.

export type Registro = Record<string, string>;

// .dbf: cabecera de 32 bytes, un descriptor de 32 bytes por campo terminado en 0x0D,
// y registros de ancho fijo cuyo primer byte marca si están borrados.
export function leerDbf(buf: Buffer): Registro[] {
  const numRegistros = buf.readUInt32LE(4);
  const largoCabecera = buf.readUInt16LE(8);
  const largoRegistro = buf.readUInt16LE(10);

  const campos: { nombre: string; largo: number }[] = [];
  for (let pos = 32; buf[pos] !== 0x0d; pos += 32) {
    campos.push({
      nombre: buf.toString("latin1", pos, pos + 11).replace(/\0.*$/, ""),
      largo: buf.readUInt8(pos + 16),
    });
  }

  const registros: Registro[] = [];
  for (let i = 0; i < numRegistros; i++) {
    let pos = largoCabecera + i * largoRegistro;
    const borrado = buf[pos] === 0x2a; // "*"
    pos += 1;
    const registro: Registro = {};
    for (const campo of campos) {
      registro[campo.nombre] = buf.toString("utf8", pos, pos + campo.largo).trim();
      pos += campo.largo;
    }
    if (!borrado) registros.push(registro);
  }
  return registros;
}

// .shp de puntos: cabecera de 100 bytes y, por registro, 8 bytes de cabecera (número y
// largo en palabras de 16 bits, big-endian), el tipo (1 = punto) y x, y en float64.
export function leerPuntosShp(buf: Buffer): { lon: number; lat: number }[] {
  const puntos: { lon: number; lat: number }[] = [];
  for (let pos = 100; pos < buf.length;) {
    const largo = buf.readInt32BE(pos + 4) * 2;
    const tipo = buf.readInt32LE(pos + 8);
    if (tipo !== 1)
      throw new Error(`Se esperaban puntos y el shapefile tiene geometrías de tipo ${tipo}`);
    puntos.push({ lon: buf.readDoubleLE(pos + 12), lat: buf.readDoubleLE(pos + 20) });
    pos += 8 + largo;
  }
  return puntos;
}
