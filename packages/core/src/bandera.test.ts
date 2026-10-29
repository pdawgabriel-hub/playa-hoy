import { describe, expect, it } from "vitest";

import { banderaProbable } from "./bandera.ts";

describe("banderaProbable", () => {
  it("con el mar tranquilo y poco viento, verde", () => {
    expect(banderaProbable(0.2, 12, "mar")).toEqual({ bandera: "verde", motivos: [] });
  });

  it("desde 0,5 m de ola, amarilla; las olas de 1,5 m siguen siendo amarilla", () => {
    expect(banderaProbable(0.49, 12, "mar")?.bandera).toBe("verde");
    expect(banderaProbable(0.5, 12, "mar")).toEqual({ bandera: "amarilla", motivos: ["ola"] });
    expect(banderaProbable(1.5, 12, "mar")?.bandera).toBe("amarilla");
  });

  it("desde 2 m de ola, roja", () => {
    expect(banderaProbable(1.99, 12, "mar")?.bandera).toBe("amarilla");
    expect(banderaProbable(2, 12, "mar")).toEqual({ bandera: "roja", motivos: ["ola"] });
  });

  it("el viento de tierra de 20 km/h pone amarilla con el mar en calma: arrastra las colchonetas", () => {
    expect(banderaProbable(0.1, 20, "tierra")).toEqual({
      bandera: "amarilla",
      motivos: ["viento_tierra"],
    });
    expect(banderaProbable(0.1, 19, "tierra")?.bandera).toBe("verde");
  });

  it("el mismo viento de mar no basta; desde 40 km/h, venga de donde venga, amarilla", () => {
    expect(banderaProbable(0.1, 20, "mar")?.bandera).toBe("verde");
    expect(banderaProbable(0.1, 40, "lado")).toEqual({ bandera: "amarilla", motivos: ["viento"] });
  });

  it("da todos los motivos de la amarilla", () => {
    expect(banderaProbable(0.8, 25, "tierra")?.motivos).toEqual(["ola", "viento_tierra"]);
  });

  it("sin la ola no se puede estimar; sin el viento, solo por la ola", () => {
    expect(banderaProbable(null, 12, "mar")).toBeNull();
    expect(banderaProbable(0.6, null, null)?.bandera).toBe("amarilla");
  });
});
