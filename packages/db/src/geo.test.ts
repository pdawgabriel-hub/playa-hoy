import { PgDialect, getTableConfig, pgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { distanciaMetros, leerPuntoEwkb, puntoWgs84 } from "./geo.ts";

const playas = pgTable("playas", { ubicacion: puntoWgs84("ubicacion") });
const [ubicacion] = getTableConfig(playas).columns;

// Valores reales devueltos por PostGIS 3.6 para Cabo de Palos
const CABO_DE_PALOS = { x: -0.692, y: 37.633 };
const EWKB_CON_SRID = "0101000020E6100000BE9F1A2FDD24E6BF1B2FDD2406D14240";
const EWKB_SIN_SRID = "0101000000BE9F1A2FDD24E6BF1B2FDD2406D14240";
const EWKB_LINEA =
  "0102000020E610000002000000000000000000000000000000000000000000000000F03F000000000000F03F";

describe("puntoWgs84", () => {
  it("crea una columna geometry de tipo punto con SRID 4326", () => {
    expect(ubicacion?.getSQLType()).toBe("geometry(Point,4326)");
  });

  it("escribe el punto en EWKT con su SRID", () => {
    expect(ubicacion?.mapToDriverValue(CABO_DE_PALOS)).toBe("SRID=4326;POINT(-0.692 37.633)");
  });

  it("lee el EWKB que devuelve PostgreSQL como { x: longitud, y: latitud }", () => {
    expect(ubicacion?.mapFromDriverValue(EWKB_CON_SRID)).toEqual(CABO_DE_PALOS);
  });
});

describe("leerPuntoEwkb", () => {
  it("lee también un punto sin SRID", () => {
    expect(leerPuntoEwkb(EWKB_SIN_SRID)).toEqual(CABO_DE_PALOS);
  });

  it("rechaza geometrías que no son puntos", () => {
    expect(() => leerPuntoEwkb(EWKB_LINEA)).toThrow(/punto/);
  });
});

describe("distanciaMetros", () => {
  it("calcula sobre geography para que el resultado salga en metros", () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      distanciaMetros(playas.ubicacion, CABO_DE_PALOS.x, CABO_DE_PALOS.y),
    );

    expect(sql).toBe(
      'ST_Distance("playas"."ubicacion"::geography, ST_SetSRID(ST_MakePoint($1, $2), $3)::geography)',
    );
    expect(params).toEqual([-0.692, 37.633, 4326]);
  });
});
