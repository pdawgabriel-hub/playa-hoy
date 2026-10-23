// Datos de ejemplo para desarrollar sin esperar a la ingesta: pnpm db:seed
// Son datos reales (códigos INE, censo de aguas de baño 2025 y códigos de AEMET), pero solo
// una muestra. La orientación y el abrigo quedan sin calcular (null) hasta la fase 3.
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import { crearDb } from "./cliente.ts";
import { municipios, playas, zonas } from "./esquema/index.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);

// Nunca contra Neon ni contra otra base de datos remota
const { hostname } = new URL(DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(hostname)) {
  throw new Error(`El seed solo se ejecuta contra la base de datos local, no contra ${hostname}`);
}

const datosMunicipios = [
  { id: "30003", nombre: "Águilas", slug: "aguilas" },
  { id: "30016", nombre: "Cartagena", slug: "cartagena" },
  { id: "30024", nombre: "Lorca", slug: "lorca" },
  { id: "30026", nombre: "Mazarrón", slug: "mazarron" },
  { id: "30035", nombre: "San Javier", slug: "san-javier" },
  { id: "30036", nombre: "San Pedro del Pinatar", slug: "san-pedro-del-pinatar" },
  { id: "30041", nombre: "La Unión", slug: "la-union" },
  { id: "30902", nombre: "Los Alcázares", slug: "los-alcazares" },
];

// Las mismas zonas que jobs/datos/zonas.json (sin descripción)
const datosZonas = [
  { nombre: "Mar Menor", slug: "mar-menor" },
  { nombre: "La Manga", slug: "la-manga" },
  { nombre: "Calblanque y Cabo de Palos", slug: "calblanque-y-cabo-de-palos" },
  { nombre: "Salinas de San Pedro", slug: "salinas-de-san-pedro" },
  { nombre: "Costa de Cartagena", slug: "costa-de-cartagena" },
  { nombre: "Bahía de Mazarrón", slug: "bahia-de-mazarron" },
  { nombre: "Costa de Lorca", slug: "costa-de-lorca" },
  { nombre: "Águilas", slug: "aguilas" },
];

type PlayaSeed = {
  nombre: string;
  slug: string;
  municipioId: string;
  zona: string | null;
  lat: number;
  lon: number;
  laguna?: boolean;
  codigoCenso: string;
  codigoAemet?: string;
};

// prettier-ignore
const datosPlayas: PlayaSeed[] = [
  { nombre: "La Carolina", slug: "la-carolina", municipioId: "30003", zona: "aguilas", lat: 37.3765, lon: -1.6281, codigoCenso: "ES620M0031597", codigoAemet: "3000301" },
  { nombre: "Levante", slug: "levante-aguilas", municipioId: "30003", zona: "aguilas", lat: 37.4068, lon: -1.5765, codigoCenso: "ES620M0031594", codigoAemet: "3000314" },
  { nombre: "Punta de Calnegre", slug: "punta-de-calnegre", municipioId: "30024", zona: "costa-de-lorca", lat: 37.5114, lon: -1.4002, codigoCenso: "ES620M0241629", codigoAemet: "3002414" },
  { nombre: "Bolnuevo", slug: "bolnuevo", municipioId: "30026", zona: "bahia-de-mazarron", lat: 37.5612, lon: -1.304, codigoCenso: "ES620M0261636", codigoAemet: "3002618" },
  { nombre: "Cala Cortina", slug: "cala-cortina", municipioId: "30016", zona: "costa-de-cartagena", lat: 37.5811, lon: -0.9747, codigoCenso: "ES620M0161617", codigoAemet: "3001624" },
  { nombre: "Portmán-El Lastre", slug: "portman-el-lastre", municipioId: "30041", zona: "costa-de-cartagena", lat: 37.5803, lon: -0.8435, codigoCenso: "ES620M0411659", codigoAemet: "3004102" },
  { nombre: "Levante", slug: "levante-cabo-de-palos", municipioId: "30016", zona: "calblanque-y-cabo-de-palos", lat: 37.6329, lon: -0.6987, codigoCenso: "ES620M0161614" },
  { nombre: "Cala Reona", slug: "cala-reona", municipioId: "30016", zona: "calblanque-y-cabo-de-palos", lat: 37.6182, lon: -0.7138, codigoCenso: "ES620M0162683" },
  { nombre: "El Galán", slug: "el-galan", municipioId: "30035", zona: "la-manga", lat: 37.6891, lon: -0.7403, codigoCenso: "ES620M0351647" },
  { nombre: "Los Urrutias", slug: "los-urrutias", municipioId: "30016", zona: "mar-menor", lat: 37.6803, lon: -0.8281, laguna: true, codigoCenso: "ES620M0161601", codigoAemet: "3001676" },
  { nombre: "Paseo de Manzanares", slug: "paseo-de-manzanares", municipioId: "30902", zona: "mar-menor", lat: 37.7404, lon: -0.8488, laguna: true, codigoCenso: "ES620M9021663", codigoAemet: "3090206" },
  { nombre: "Villananitos", slug: "villananitos", municipioId: "30036", zona: "mar-menor", lat: 37.8195, lon: -0.7809, laguna: true, codigoCenso: "ES620M0361655", codigoAemet: "3003602" },
  { nombre: "La Llana-Las Salinas", slug: "la-llana-las-salinas", municipioId: "30036", zona: "salinas-de-san-pedro", lat: 37.8172, lon: -0.7582, codigoCenso: "ES620M0361654", codigoAemet: "3003606" },
];

const { db, cerrar } = crearDb(DATABASE_URL);

try {
  // Se puede repetir: lo que ya existe no se toca
  await db.insert(municipios).values(datosMunicipios).onConflictDoNothing();
  await db.insert(zonas).values(datosZonas).onConflictDoNothing();

  const idsZonas = new Map(
    (await db.select({ id: zonas.id, slug: zonas.slug }).from(zonas)).map((z) => [z.slug, z.id]),
  );

  const insertadas = await db
    .insert(playas)
    .values(
      datosPlayas.map(({ zona, lat, lon, ...playa }) => ({
        ...playa,
        zonaId: zona ? idsZonas.get(zona) : null,
        ubicacion: { x: lon, y: lat },
      })),
    )
    .onConflictDoNothing()
    .returning({ id: playas.id });

  console.log(
    `Seed aplicado: ${datosMunicipios.length} municipios, ${datosZonas.length} zonas, ` +
      `${insertadas.length} playas nuevas de ${datosPlayas.length}`,
  );
} finally {
  await cerrar();
}
