// Red simulada para todos los tests de jobs (MSW). Cada test añade las respuestas que
// necesita con `redSimulada.use(...)`. Una petición sin respuesta simulada falla: ningún
// test puede salir a la red de verdad, ni por descuido.
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

export const redSimulada = setupServer();

beforeAll(() => {
  redSimulada.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  redSimulada.resetHandlers();
});

afterAll(() => {
  redSimulada.close();
});
