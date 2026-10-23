import { describe, expect, it } from "vitest";

import { leerDbf, leerPuntosShp } from "./shapefile.ts";

// Construye un .dbf mínimo con campos de texto
function crearDbf(
  campos: { nombre: string; largo: number }[],
  filas: string[][],
  borradas = new Set<number>(),
) {
  const largoCabecera = 32 + 32 * campos.length + 1;
  const largoRegistro = 1 + campos.reduce((s, c) => s + c.largo, 0);
  const buf = Buffer.alloc(largoCabecera + largoRegistro * filas.length, 0x20);
  buf.fill(0, 0, largoCabecera);
  buf.writeUInt8(3, 0);
  buf.writeUInt32LE(filas.length, 4);
  buf.writeUInt16LE(largoCabecera, 8);
  buf.writeUInt16LE(largoRegistro, 10);
  campos.forEach((c, i) => {
    const pos = 32 + i * 32;
    buf.write(c.nombre, pos, "latin1");
    buf.write("C", pos + 11, "latin1");
    buf.writeUInt8(c.largo, pos + 16);
  });
  buf.writeUInt8(0x0d, largoCabecera - 1);
  filas.forEach((fila, i) => {
    let pos = largoCabecera + i * largoRegistro;
    buf.write(borradas.has(i) ? "*" : " ", pos, "latin1");
    pos += 1;
    fila.forEach((valor, j) => {
      buf.write(valor, pos, "utf8");
      pos += campos[j]?.largo ?? 0;
    });
  });
  return buf;
}

// Construye un .shp mínimo de puntos
function crearShp(puntos: [number, number][], tipo = 1) {
  const buf = Buffer.alloc(100 + puntos.length * 28);
  puntos.forEach(([lon, lat], i) => {
    const pos = 100 + i * 28;
    buf.writeInt32BE(i + 1, pos);
    buf.writeInt32BE(10, pos + 4); // 20 bytes de contenido = 10 palabras
    buf.writeInt32LE(tipo, pos + 8);
    buf.writeDoubleLE(lon, pos + 12);
    buf.writeDoubleLE(lat, pos + 20);
  });
  return buf;
}

describe("leerDbf", () => {
  const campos = [
    { nombre: "localId", largo: 16 },
    { nombre: "nameText", largo: 30 },
  ];

  it("lee los atributos de cada registro, con UTF-8 y sin espacios de relleno", () => {
    const dbf = crearDbf(campos, [
      ["ES620M0031597", "PLAYA LA CAROLINA PM1"],
      ["ES620M9021665", "PLAYA PASEO CARRIÓN PM1"],
    ]);

    expect(leerDbf(dbf)).toEqual([
      { localId: "ES620M0031597", nameText: "PLAYA LA CAROLINA PM1" },
      { localId: "ES620M9021665", nameText: "PLAYA PASEO CARRIÓN PM1" },
    ]);
  });

  it("se salta los registros marcados como borrados", () => {
    const dbf = crearDbf(
      campos,
      [
        ["A", "uno"],
        ["B", "dos"],
      ],
      new Set([0]),
    );

    expect(leerDbf(dbf)).toEqual([{ localId: "B", nameText: "dos" }]);
  });
});

describe("leerPuntosShp", () => {
  it("lee longitud y latitud de cada punto, en orden", () => {
    expect(
      leerPuntosShp(
        crearShp([
          [-1.6281, 37.3765],
          [-0.6987, 37.6329],
        ]),
      ),
    ).toEqual([
      { lon: -1.6281, lat: 37.3765 },
      { lon: -0.6987, lat: 37.6329 },
    ]);
  });

  it("rechaza geometrías que no son puntos", () => {
    expect(() => leerPuntosShp(crearShp([[0, 0]], 5))).toThrow(/puntos/);
  });
});
