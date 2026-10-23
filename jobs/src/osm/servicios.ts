// Interpretación de los datos de OpenStreetMap para los servicios de las playas.
// Regla general: la ausencia de dato no es un "no". OSM solo da true (hay un servicio
// mapeado, o la etiqueta lo dice) o false cuando una etiqueta lo dice explícitamente.
import type { ElementoOsm } from "./overpass.ts";

export type ServiciosOsm = {
  socorrista: boolean | null;
  perros: boolean | null;
  aseos: boolean | null;
  duchas: boolean | null;
};

// yes / no y sus variantes. Un horario ("Jul-Aug") significa que lo hay en temporada.
function siNo(valor: string | undefined, positivos: string[] = ["yes"]): boolean | null {
  if (valor === undefined) return null;
  if (valor === "no") return false;
  if (positivos.includes(valor) || /^[A-Z][a-z]{2}-[A-Z][a-z]{2}$/.test(valor)) return true;
  return null;
}

// Etiquetas de la propia playa (natural=beach)
export function serviciosDeEtiquetas(etiquetas: Record<string, string>): ServiciosOsm {
  return {
    socorrista: siNo(etiquetas.supervised) ?? siNo(etiquetas.lifeguard),
    perros: siNo(etiquetas.dog, ["yes", "leashed", "unleashed"]),
    aseos: siNo(etiquetas.toilets),
    duchas: siNo(etiquetas.shower),
  };
}

export type TipoServicio = "socorrista" | "aseos" | "duchas";

// Puntos de servicio cercanos a la playa
export function tipoDeServicio(etiquetas: Record<string, string>): TipoServicio | null {
  if (etiquetas.amenity === "toilets") return "aseos";
  if (etiquetas.amenity === "shower") return "duchas";
  if (etiquetas.emergency?.startsWith("lifeguard")) return "socorrista";
  return null;
}

type Punto = { lat: number; lon: number } | null;
type GeoJson =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "LineString"; coordinates: number[][] }
  | { type: "MultiLineString"; coordinates: number[][][] };

const aCoordenadas = (puntos: Punto[]) =>
  puntos.filter((p) => p !== null).map((p) => [p.lon, p.lat]);

// Geometría GeoJSON de una playa de OSM. Un way cerrado es un polígono; uno abierto, una
// línea (playas mapeadas como tramo de costa). En una relación se devuelven las líneas
// exteriores y PostGIS reconstruye el área (ST_BuildArea).
export function geometriaPlaya(elemento: ElementoOsm): GeoJson | null {
  if (elemento.type === "way" && elemento.geometry) {
    const coordenadas = aCoordenadas(elemento.geometry);
    if (coordenadas.length < 2) return null;
    const [primero] = coordenadas;
    const ultimo = coordenadas.at(-1);
    const cerrado =
      coordenadas.length >= 4 && primero?.[0] === ultimo?.[0] && primero?.[1] === ultimo?.[1];
    return cerrado
      ? { type: "Polygon", coordinates: [coordenadas] }
      : { type: "LineString", coordinates: coordenadas };
  }
  if (elemento.type === "relation" && elemento.members) {
    const lineas = elemento.members
      .filter((m) => m.role === "outer" && m.geometry)
      .map((m) => aCoordenadas(m.geometry ?? []))
      .filter((l) => l.length >= 2);
    return lineas.length > 0 ? { type: "MultiLineString", coordinates: lineas } : null;
  }
  return null;
}

// Punto de un servicio: los nodos traen lat/lon; los ways, el centro
export function puntoDeServicio(elemento: ElementoOsm): { lat: number; lon: number } | null {
  if (elemento.lat !== undefined && elemento.lon !== undefined)
    return { lat: elemento.lat, lon: elemento.lon };
  return elemento.center ?? null;
}
