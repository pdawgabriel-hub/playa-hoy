import { type SQL, sql } from "drizzle-orm";
import { type AnyPgColumn, customType } from "drizzle-orm/pg-core";

// WGS84: longitud y latitud en grados, el sistema en el que llegan todas las fuentes.
export const SRID_WGS84 = 4326;

export interface Punto {
  x: number; // longitud
  y: number; // latitud
}

// Tipo propio porque la columna geometry de Drizzle 0.45 ignora el SRID: genera
// geometry(point) en lugar de geometry(Point,4326).
export const puntoWgs84 = customType<{ data: Punto; driverData: string }>({
  dataType: () => `geometry(Point,${SRID_WGS84})`,
  // EWKT con el SRID explícito. PostGIS asigna el de la columna a un punto sin SRID y
  // rechaza uno con otro SRID (por ejemplo UTM, 25830), así que nunca se mezclan sistemas.
  toDriver: ({ x, y }) => `SRID=${SRID_WGS84};POINT(${x} ${y})`,
  fromDriver: (valor) => leerPuntoEwkb(valor),
});

const TIPO_PUNTO = 1;
const TIPO_LINEA = 2;
const BANDERA_SRID = 0x20_00_00_00;

// Cabecera EWKB: orden de bytes, tipo (con una bandera si incluye SRID) y SRID opcional.
// Devuelve el tipo y dónde empiezan los datos.
function leerCabeceraEwkb(hex: string) {
  const bytes = Uint8Array.from(hex.match(/../g) ?? [], (par) => Number.parseInt(par, 16));
  const vista = new DataView(bytes.buffer);
  const littleEndian = vista.getUint8(0) === 1;
  const tipo = vista.getUint32(1, littleEndian);
  return { vista, littleEndian, tipo: tipo & 0xff_ff, inicio: tipo & BANDERA_SRID ? 9 : 5 };
}

// PostgreSQL devuelve las geometrías en EWKB (binario en hexadecimal): cabecera y
// las coordenadas en float64.
export function leerPuntoEwkb(hex: string): Punto {
  const { vista, littleEndian, tipo, inicio } = leerCabeceraEwkb(hex);
  if (tipo !== TIPO_PUNTO) throw new Error(`Se esperaba un punto en EWKB y llegó el tipo ${tipo}`);
  return {
    x: vista.getFloat64(inicio, littleEndian),
    y: vista.getFloat64(inicio + 8, littleEndian),
  };
}

// Línea: tras la cabecera, el número de puntos (uint32) y sus coordenadas
export function leerLineaEwkb(hex: string): Punto[] {
  const { vista, littleEndian, tipo, inicio } = leerCabeceraEwkb(hex);
  if (tipo !== TIPO_LINEA) throw new Error(`Se esperaba una línea en EWKB y llegó el tipo ${tipo}`);
  const total = vista.getUint32(inicio, littleEndian);
  return Array.from({ length: total }, (_, i) => ({
    x: vista.getFloat64(inicio + 4 + i * 16, littleEndian),
    y: vista.getFloat64(inicio + 12 + i * 16, littleEndian),
  }));
}

// Columna de línea en WGS84, como lista de puntos { x: longitud, y: latitud } en orden.
// El orden importa: en la costa de OpenStreetMap, el mar queda a la derecha.
export const lineaWgs84 = customType<{ data: Punto[]; driverData: string }>({
  dataType: () => `geometry(LineString,${SRID_WGS84})`,
  toDriver: (puntos) =>
    `SRID=${SRID_WGS84};LINESTRING(${puntos.map(({ x, y }) => `${x} ${y}`).join(",")})`,
  fromDriver: (valor) => leerLineaEwkb(valor),
});

// Distancia en metros sobre el elipsoide. Con geometry a secas saldría en grados.
export function distanciaMetros(columna: AnyPgColumn, lon: number, lat: number): SQL<number> {
  return sql<number>`ST_Distance(${columna}::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), ${SRID_WGS84})::geography)`;
}
