import { describe, expect, it } from "vitest";

import { nombreDesdeCenso } from "./nombres.ts";

const tildes = { galan: "galán", portman: "portmán", mojon: "mojón", azohia: "azohía" };

describe("nombreDesdeCenso", () => {
  it.each([
    ["PLAYA LA CAROLINA PM1", "La Carolina"],
    ["PLAYA DEL GALAN PM1", "El Galán"],
    ["PLAYA DE EL CHARCO PM1", "El Charco"],
    ["PLAYA DE LEVANTE PM1", "Levante"],
    ["PLAYA DE LA CASICA VERDE PM1", "La Casica Verde"],
    ["PLAYA PUNTA DE CALNEGRE PM1", "Punta de Calnegre"],
    ["PLAYA MAR DE CRISTAL PM1", "Mar de Cristal"],
    ["PLAYA PLAYA RIGUETE PM1", "Riguete"],
    ["PLAYAS LOS ALISIOS PM1", "Los Alisios"],
    ["PLAYA LA AZOHIA-PLAYA EL CUARTEL PM1", "La Azohía-El Cuartel"],
    ["PLAYA PORTMAN-EL LASTRE PM1", "Portmán-El Lastre"],
    ["PLAYA EL MOJON-DERECHA PM1", "El Mojón-Derecha"],
    ["PLAYA DE LEVANTE-ISLAS MENORES PM1", "Levante-Islas Menores"],
    ["PLAYA LOS NIETOS PM2", "Los Nietos"],
  ])("%s -> %s", (texto, nombre) => {
    expect(nombreDesdeCenso(texto, tildes)).toBe(nombre);
  });

  it("deja las palabras sin tilde conocida tal cual", () => {
    expect(nombreDesdeCenso("PLAYA CALABARDINA PM1", {})).toBe("Calabardina");
  });
});
