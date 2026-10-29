// Calcula las condiciones en la orilla y las notas de los cuatro planes de cada playa, desde
// la hora actual hasta donde llegue la previsión: pnpm --filter @playa-hoy/jobs calcular:notas
// Sustituye el cálculo anterior. Se ejecuta tras cada ingesta de Open-Meteo.
import { crearDb } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { calcularNotas } from "./notas.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const { playas, horas, notas, horasConAguaAemet } = await calcularNotas(db);
  console.log(
    `Notas: ${notas.toString()} de ${playas.toString()} playas en ${horas.toString()} horas` +
      ` (${horasConAguaAemet.toString()} horas con el agua de AEMET en el Mar Menor)`,
  );
} finally {
  await cerrar();
}
