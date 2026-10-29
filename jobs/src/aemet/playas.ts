// Cliente de AEMET OpenData: predicción específica de playas.
//
// De esta predicción solo interesa de verdad la temperatura del agua (sobre todo la del Mar
// Menor, que Open-Meteo no da): el viento y el oleaje vienen por categorías y sin dirección.
import { horaEspanaAUtc } from "@playa-hoy/shared";
import { z } from "zod";

import { type OpcionesAemet, consultarUnoAUno, pedirAemet } from "./comun.ts";

// Mañana y tarde, por categorías ("flojo", "débil", "nuboso"...)
const esquemaDoble = z.object({ descripcion1: z.string(), descripcion2: z.string() });
const esquemaValor = z.object({ valor1: z.number() });

const esquemaPrediccion = z
  .array(
    z.object({
      nombre: z.string(),
      // Hora oficial de España, sin zona horaria
      elaborado: z.string(),
      prediccion: z.object({
        dia: z.array(
          z.object({
            // 20261023
            fecha: z.number(),
            estadoCielo: esquemaDoble,
            viento: esquemaDoble,
            oleaje: esquemaDoble,
            tMaxima: esquemaValor,
            tAgua: esquemaValor,
            uvMax: esquemaValor,
          }),
        ),
      }),
    }),
  )
  .length(1);

export type MananaYTarde = { manana: string; tarde: string };

export type DiaPlayaAemet = {
  // "2026-10-23"
  fecha: string;
  // °C, en grados enteros
  temperaturaAgua: number;
  temperaturaMaxima: number;
  uvMaximo: number;
  cielo: MananaYTarde;
  viento: MananaYTarde;
  oleaje: MananaYTarde;
};

export type PrediccionPlayaAemet = {
  nombre: string;
  // En UTC
  elaborado: Date;
  dias: DiaPlayaAemet[];
};

const mananaYTarde = ({
  descripcion1,
  descripcion2,
}: z.infer<typeof esquemaDoble>): MananaYTarde => ({
  manana: descripcion1,
  tarde: descripcion2,
});

export function leerPrediccionPlaya(datos: unknown): PrediccionPlayaAemet {
  const [playa] = esquemaPrediccion.parse(datos);
  if (!playa) throw new Error("AEMET no devolvió ninguna playa");

  return {
    nombre: playa.nombre,
    elaborado: horaEspanaAUtc(playa.elaborado),
    dias: playa.prediccion.dia.map((dia) => {
      const f = String(dia.fecha);
      return {
        fecha: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`,
        temperaturaAgua: dia.tAgua.valor1,
        temperaturaMaxima: dia.tMaxima.valor1,
        uvMaximo: dia.uvMax.valor1,
        cielo: mananaYTarde(dia.estadoCielo),
        viento: mananaYTarde(dia.viento),
        oleaje: mananaYTarde(dia.oleaje),
      };
    }),
  };
}

// `codigo`: el de la playa en AEMET (7 dígitos, por ejemplo 3090206)
export async function consultarPlayaAemet(
  codigo: string,
  clave: string,
  opciones: OpcionesAemet = {},
) {
  return leerPrediccionPlaya(
    await pedirAemet(`/prediccion/especifica/playa/${codigo}`, clave, opciones),
  );
}

// Una playa detrás de otra; si falla alguna, se sigue con las demás (ver consultarUnoAUno)
export async function consultarPlayasAemet(
  codigos: string[],
  clave: string,
  opciones: OpcionesAemet = {},
) {
  const { resultados, errores } = await consultarUnoAUno(
    codigos,
    (codigo) => consultarPlayaAemet(codigo, clave, opciones),
    { que: "playa", pausaMs: opciones.pausaMs },
  );
  return { predicciones: resultados, errores };
}
