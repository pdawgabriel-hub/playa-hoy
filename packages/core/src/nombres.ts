// Artículos y preposiciones que van en minúscula dentro de un nombre ("Punta de Calnegre")
const MINUSCULAS = new Set(["a", "de", "del", "el", "la", "las", "los", "y"]);

// Convierte el nombre del censo de aguas de baño ("PLAYA DEL GALAN PM1") en uno legible
// ("El Galán"). El censo no trae tildes: `tildes` las repone palabra a palabra.
export function nombreDesdeCenso(texto: string, tildes: Record<string, string>): string {
  const limpio = texto
    .toUpperCase()
    .replace(/\s+PM\d+$/, "")
    .trim()
    // "PLAYA", "PLAYAS" y también "PLAYA PLAYA RIGUETE"
    .replace(/^(PLAYAS?\s+)+/, "")
    // "LA AZOHIA-PLAYA EL CUARTEL"
    .replace(/-PLAYAS?\s+/g, "-")
    // "PLAYA DE EL CHARCO" y "PLAYA DEL GALAN" -> "El ...", "PLAYA DE LEVANTE" -> "Levante"
    .replace(/^(DE EL|DEL)\s+/, "EL ")
    .replace(/^DE\s+/, "")
    .replace(/\s+/g, " ");

  const partes = limpio.split(/([ -])/);
  return partes
    .map((parte, i) => {
      if (parte === " " || parte === "-") return parte;
      const palabra = parte.toLowerCase();
      const alPrincipio = i === 0 || partes[i - 1] === "-";
      if (!alPrincipio && MINUSCULAS.has(palabra)) return palabra;
      const conTilde = tildes[palabra] ?? palabra;
      return conTilde.charAt(0).toUpperCase() + conTilde.slice(1);
    })
    .join("");
}
