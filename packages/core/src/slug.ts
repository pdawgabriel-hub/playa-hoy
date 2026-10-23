// Identificador para URLs a partir de un nombre: "Portmán-El Lastre" -> "portman-el-lastre".
// Mismo formato que exige la base de datos: minúsculas, números y guiones simples.
export function crearSlug(nombre: string): string {
  return (
    nombre
      // Separa las letras de sus tildes (á -> a + ´) para quitar las tildes después
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
