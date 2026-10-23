import { describe, expect, it } from "vitest";

import { enHoraEspana, horaEspanaAUtc } from "./horas.ts";

describe("zona horaria de los tests", () => {
  // vitest.config.ts la fija en UTC+14: si algo usara la hora local de la máquina, en esta
  // zona casi siempre cambiaría de día y los tests lo detectarían
  it("es Pacific/Kiritimati, no la de la máquina", () => {
    expect(new Date("2026-10-23T12:00:00Z").getTimezoneOffset()).toBe(-14 * 60);
  });
});

describe("horaEspanaAUtc", () => {
  it("en verano resta dos horas y en invierno una", () => {
    expect(horaEspanaAUtc("2026-07-15T12:00:00")).toEqual(new Date("2026-07-15T10:00:00Z"));
    expect(horaEspanaAUtc("2026-12-15T12:00:00")).toEqual(new Date("2026-12-15T11:00:00Z"));
  });

  it("acierta justo después del cambio de hora", () => {
    // El 25/10/2026 a las 3:00 de verano se vuelve a las 2:00 de invierno
    expect(horaEspanaAUtc("2026-10-25T04:00:00")).toEqual(new Date("2026-10-25T03:00:00Z"));
    // El 29/03/2026 a las 2:00 de invierno se pasa a las 3:00 de verano
    expect(horaEspanaAUtc("2026-03-29T04:00:00")).toEqual(new Date("2026-03-29T02:00:00Z"));
  });

  it("rechaza un texto que no es una hora", () => {
    expect(() => horaEspanaAUtc("ayer")).toThrow(/no válida/);
  });
});

describe("enHoraEspana", () => {
  it("suma dos horas en verano y una en invierno", () => {
    expect(enHoraEspana(new Date("2026-07-15T10:00:00Z"))).toEqual({
      fecha: "2026-07-15",
      hora: "12:00",
    });
    expect(enHoraEspana(new Date("2026-12-15T11:00:00Z"))).toEqual({
      fecha: "2026-12-15",
      hora: "12:00",
    });
  });

  it("de noche en UTC ya puede ser el día siguiente en España", () => {
    expect(enHoraEspana(new Date("2026-10-23T22:30:00Z"))).toEqual({
      fecha: "2026-10-24",
      hora: "00:30",
    });
  });

  it("es la inversa de horaEspanaAUtc", () => {
    const instante = horaEspanaAUtc("2026-10-23T08:51:00");

    expect(enHoraEspana(instante)).toEqual({ fecha: "2026-10-23", hora: "08:51" });
  });
});
