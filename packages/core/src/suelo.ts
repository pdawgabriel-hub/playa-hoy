export const SUELOS = ["arena_fina", "arena", "arena_y_grava", "grava", "bolos", "roca"] as const;
export type Suelo = (typeof SUELOS)[number];

// Para valores que llegan como texto (la base de datos)
export const esSuelo = (valor: unknown): valor is Suelo =>
  typeof valor === "string" && SUELOS.some((s) => s === valor);

// Clasifica la descripción del suelo de ITREM ("ARENA FINA Y DORADA", "BOLOS Y PIEDRAS"...)
// por el material dominante, que es el primero que se nombra. El color no cuenta.
// Devuelve null si no se sabe ("SIN DETERMINAR") o no se reconoce.
export function clasificarSuelo(descripcion: string): Suelo | null {
  const texto = descripcion.toUpperCase();
  const tiene = (material: string) => texto.includes(material);
  const primero = texto.trim().split(/[\s,]+/)[0];

  if (primero === "ARENA") {
    if (tiene("GRAVA") || tiene("BOLOS") || tiene("PIEDRAS") || tiene("ROCA"))
      return "arena_y_grava";
    return tiene("FINA") ? "arena_fina" : "arena";
  }
  if (primero === "GRAVA") return "grava";
  if (primero === "BOLOS") return "bolos";
  if (primero === "ROCA" || primero === "PIEDRAS") return "roca";
  return null;
}
