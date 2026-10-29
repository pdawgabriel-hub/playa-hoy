import { describe, expect, it } from "vitest";

import { esquemaAemet, esquemaBaseDatos, esquemaServidor, leerEntorno } from "./entorno.ts";

describe("leerEntorno", () => {
  it("acepta una cadena de conexión de PostgreSQL", () => {
    const url = "postgresql://playa:playa@localhost:5435/playahoy";

    expect(leerEntorno(esquemaBaseDatos, { DATABASE_URL: url })).toEqual({ DATABASE_URL: url });
  });

  it("acepta también el esquema postgres://, el que da Neon", () => {
    const url = "postgres://usuario:clave@ep-ejemplo.eu-central-1.aws.neon.tech/neondb";

    expect(leerEntorno(esquemaBaseDatos, { DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it("rechaza channel_binding, que Neon añade y el driver no admite, y dice qué hacer", () => {
    const url =
      "postgresql://u:c@ep-ejemplo.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

    expect(() => leerEntorno(esquemaBaseDatos, { DATABASE_URL: url })).toThrow(
      /quita channel_binding/,
    );
  });

  it("rechaza una URL que no es de PostgreSQL", () => {
    expect(() => leerEntorno(esquemaBaseDatos, { DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("indica qué variable falta", () => {
    expect(() => leerEntorno(esquemaAemet, {})).toThrow(/AEMET_API_KEY/);
  });

  it("rechaza una clave de AEMET vacía", () => {
    expect(() => leerEntorno(esquemaAemet, { AEMET_API_KEY: "" })).toThrow(/AEMET_API_KEY/);
  });

  it("convierte PORT a número y usa 3001 si no se indica", () => {
    expect(leerEntorno(esquemaServidor, { PORT: "8080" })).toEqual({ PORT: 8080 });
    expect(leerEntorno(esquemaServidor, {})).toEqual({ PORT: 3001 });
  });

  it("rechaza un puerto fuera de rango", () => {
    expect(() => leerEntorno(esquemaServidor, { PORT: "70000" })).toThrow(/PORT/);
  });

  it("ignora las variables que no pertenecen al esquema", () => {
    expect(leerEntorno(esquemaServidor, { PORT: "3001", HOME: "/home/gabriel" })).toEqual({
      PORT: 3001,
    });
  });
});
