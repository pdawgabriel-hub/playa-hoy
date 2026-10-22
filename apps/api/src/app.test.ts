import { describe, expect, it } from "vitest";

import { app } from "./app.ts";

describe("GET /", () => {
  it("responde que la API está viva", async () => {
    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nombre: "playa·hoy API", estado: "ok" });
  });
});
