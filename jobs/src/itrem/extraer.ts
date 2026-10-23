// Descarga el conjunto "Playas" del Instituto de Turismo de la Región de Murcia (ITREM) y
// guarda en jobs/datos/itrem-playas.json los campos que usa playa·hoy, tal como vienen.
//   pnpm --filter @playa-hoy/jobs extraer:itrem
import { writeFile } from "node:fs/promises";

import { z } from "zod";

const URL_ITREM = "https://nexo.carm.es/nexo/archivos/recursos/opendata/json/Playas.json";

const respuesta = await fetch(URL_ITREM);
if (!respuesta.ok) throw new Error(`ITREM respondió ${respuesta.status}`);
// El fichero empieza con una marca BOM que JSON.parse no acepta
const datos = z
  .array(z.record(z.string(), z.string()))
  .parse(JSON.parse((await respuesta.text()).replace(/^\uFEFF/, "")));

const playas = datos
  .map((p) => ({
    codigo: p["Código"] ?? "",
    nombre: p.Nombre ?? "",
    municipio: p.Municipio ?? "",
    mar: p.Mar ?? "",
    suelo: p["Tipo Suelo"] ?? "",
    ocupacion: p["Ocupación"] ?? "",
    nudista: p.Nudista ?? "",
    accesible: p.Accesible ?? "",
    latitud: p.Latitud ?? "",
    longitud: p.Longitud ?? "",
  }))
  .toSorted((a, b) => Number(a.codigo) - Number(b.codigo));

const fichero = {
  fuente: `Instituto de Turismo de la Región de Murcia (ITREM), conjunto "Playas": ${URL_ITREM}`,
  licencia:
    "El catálogo no declara licencia: se aplican las condiciones generales de reutilización de la Ley 37/2007 (citar la fuente y la fecha, no desnaturalizar los datos). No se usan las fotos.",
  actualizacion: "Ficha del catálogo modificada el 23/04/2018",
  descargado: new Date().toISOString().slice(0, 10),
  avisos: [
    "Las coordenadas mezclan sistemas: la mayoría son UTM huso 30 en ED50 (EPSG:23030), pero las de Mazarrón y Lorca están en grados con la latitud en el campo longitud y al revés.",
    "Municipio 'La Manga' no es un municipio: La Manga se reparte entre Cartagena y San Javier.",
  ],
  playas,
};

const destino = new URL("../../datos/itrem-playas.json", import.meta.url);
await writeFile(destino, `${JSON.stringify(fichero, null, 2)}\n`);
console.log(`ITREM: ${playas.length} playas -> ${destino.pathname}`);
