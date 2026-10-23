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
  // EWKT: sin el SRID, PostgreSQL rechaza el valor en una columna con SRID
  toDriver: ({ x, y }) => `SRID=${SRID_WGS84};POINT(${x} ${y})`,
  fromDriver: (valor) => leerPuntoEwkb(valor),
});

const TIPO_PUNTO = 1;
const BANDERA_SRID = 0x20_00_00_00;

// PostgreSQL devuelve las geometrías en EWKB (binario en hexadecimal): orden de bytes,
// tipo (con una bandera si incluye SRID), SRID opcional y las coordenadas en float64.
export function leerPuntoEwkb(hex: string): Punto {
  const bytes = Uint8Array.from(hex.match(/../g) ?? [], (par) => Number.parseInt(par, 16));
  const vista = new DataView(bytes.buffer);
  const littleEndian = vista.getUint8(0) === 1;
  const tipo = vista.getUint32(1, littleEndian);

  if ((tipo & 0xff_ff) !== TIPO_PUNTO) {
    throw new Error(`Se esperaba un punto en EWKB y llegó el tipo ${tipo & 0xff_ff}`);
  }

  const inicio = tipo & BANDERA_SRID ? 9 : 5;
  return {
    x: vista.getFloat64(inicio, littleEndian),
    y: vista.getFloat64(inicio + 8, littleEndian),
  };
}

// Distancia en metros sobre el elipsoide. Con geometry a secas saldría en grados.
export function distanciaMetros(columna: AnyPgColumn, lon: number, lat: number): SQL<number> {
  return sql<number>`ST_Distance(${columna}::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), ${SRID_WGS84})::geography)`;
}
