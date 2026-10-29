// Razones legibles de una nota: convierten el detalle de factores en frases cortas, con su
// cifra, para explicar por qué una playa sale bien o mal en un plan.
import type { Condiciones, Lado, NotaPerfil, Perfil } from "./perfiles/comun.ts";

export type Razon = {
  // descarta: el factor está en 0 y deja la nota en 0
  tipo: "descarta" | "en_contra" | "a_favor";
  factor: string;
  texto: string;
};

// Por debajo de este valor un factor se menciona en contra; desde FAVOR, a favor. Entre los
// dos no se dice nada: ni ayuda ni estorba lo bastante.
const CONTRA = 0.65;
const FAVOR = 0.9;
export const MAX_RAZONES = 4;
// Por debajo, "mar en calma" en lugar de "poca ola (0 m)"
const CALMA_M = 0.05;

const numero = (valor: number, decimales = 0) =>
  valor.toLocaleString("es-ES", { maximumFractionDigits: decimales });
const metros = (valor: number | null) => `${numero(valor ?? 0, 1)} m`;
const kmh = (valor: number | null) => `${numero(valor ?? 0)} km/h`;
const grados = (valor: number | null) => `${numero(valor ?? 0)} °C`;

// Cada frase recibe las condiciones y, en los factores de meseta, el lado por el que fallan.
// Devuelve null si en ese caso no hay nada que decir.
type Texto = (c: Condiciones, lado: Lado | undefined) => string | null;
type Frases = { favor?: Texto; contra?: Texto; descarta?: Texto };

// Frases de cada factor, comunes a todos los perfiles
const COMUNES: Record<string, Frases> = {
  ola: {
    favor: (c) =>
      (c.olaOrilla ?? 0) < CALMA_M
        ? "Mar en calma"
        : `Poca ola en la orilla (${metros(c.olaOrilla)})`,
    contra: (c) => `Ola de ${metros(c.olaOrilla)} en la orilla`,
    descarta: (c) => `Demasiada ola (${metros(c.olaOrilla)} en la orilla)`,
  },
  viento: {
    favor: (c) =>
      c.entradaViento === "calma" ? "Sin viento" : `Viento suave (${kmh(c.vientoVelocidad)})`,
    contra: (c) => `Viento de ${kmh(c.vientoVelocidad)}`,
    descarta: (c) => `Viento fuerte (${kmh(c.vientoVelocidad)})`,
  },
  temperatura_aire: {
    favor: (c) => `Temperatura agradable (${grados(c.temperaturaAire)})`,
    contra: (c, lado) =>
      lado === "alto"
        ? `Calor (${grados(c.temperaturaAire)})`
        : `Fresco (${grados(c.temperaturaAire)})`,
  },
  temperatura_agua: {
    favor: (c) => `Agua templada (${grados(c.temperaturaAgua)})`,
    contra: (c) => `Agua fría (${grados(c.temperaturaAgua)})`,
  },
  claridad: {
    favor: () => "Agua cristalina",
    contra: () => "Agua algo turbia",
  },
  socorrista: {
    favor: () => "Con socorrista",
    contra: (c) => (c.socorrista === false ? "Sin socorrista" : null),
  },
  nubosidad: {
    favor: () => "Cielo despejado",
    contra: (c) => `Nubes (${numero(c.nubosidad ?? 0)} % del cielo)`,
  },
};

// Lo que cambia de sentido en cada perfil
const POR_PERFIL: Record<Perfil, Record<string, Frases>> = {
  familia: {
    ola: { descarta: (c) => `Demasiada ola para niños (${metros(c.olaOrilla)} en la orilla)` },
    viento: {
      contra: (c) =>
        c.entradaViento === "tierra"
          ? `Viento de tierra (${kmh(c.vientoVelocidad)}): cuidado con los hinchables`
          : `Viento de ${kmh(c.vientoVelocidad)}`,
      descarta: (c) =>
        c.entradaViento === "tierra"
          ? `Viento de tierra (${kmh(c.vientoVelocidad)}): arrastra los hinchables mar adentro`
          : `Viento fuerte (${kmh(c.vientoVelocidad)})`,
    },
  },
  snorkel: {
    ola: {
      descarta: (c) => `Demasiada ola: la resaca empuja contra las rocas (${metros(c.olaOrilla)})`,
    },
    viento: {
      descarta: (c) =>
        c.entradaViento === "tierra"
          ? `Viento de tierra (${kmh(c.vientoVelocidad)}): aleja de la orilla`
          : `Viento fuerte (${kmh(c.vientoVelocidad)}): mar picado`,
    },
    claridad: {
      favor: () => "Agua cristalina: buena visibilidad",
      contra: () => "Agua algo turbia: poca visibilidad",
      descarta: () => "Agua turbia: no se verá el fondo",
    },
    fondo: {
      favor: () => "Fondo de roca: más vida marina",
      contra: () => "Fondo de arena: poca vida marina",
    },
  },
  sol: {
    temperatura_aire: {
      descarta: (c, lado) =>
        lado === "alto"
          ? `Demasiado calor: riesgo de golpe de calor (${grados(c.temperaturaAire)})`
          : `Demasiado frío para tumbarse (${grados(c.temperaturaAire)})`,
    },
    viento: {
      contra: (c) => `Viento de ${kmh(c.vientoVelocidad)}: arena y frío`,
      descarta: (c) => `Viento fuerte (${kmh(c.vientoVelocidad)}): vuela la arena`,
    },
    nubosidad: { descarta: () => "Cielo cubierto" },
    // La ola apenas cuenta para tomar el sol: no se menciona a favor
    ola: { favor: () => null, contra: (c) => `Mar movido (${metros(c.olaOrilla)})` },
  },
  surf: {
    ola: {
      favor: (c) => `Buena ola (${metros(c.olaOrilla)} en la orilla)`,
      contra: (c, lado) =>
        lado === "alto"
          ? `Ola grande (${metros(c.olaOrilla)} en la orilla)`
          : `Poca ola (${metros(c.olaOrilla)} en la orilla)`,
      descarta: (c, lado) =>
        lado === "alto"
          ? `Demasiada ola: peligroso (${metros(c.olaOrilla)} en la orilla)`
          : "Sin ola para surfear",
    },
    periodo: {
      favor: (c) => `Periodo largo (${numero(c.olaPeriodo ?? 0)} s): ola ordenada`,
      contra: (c) => `Periodo corto (${numero(c.olaPeriodo ?? 0)} s): ola desordenada`,
      descarta: (c) => `Mar de viento, sin ola surfeable (${numero(c.olaPeriodo ?? 0)} s)`,
    },
    viento: {
      favor: (c) =>
        c.entradaViento === "tierra"
          ? `Viento de tierra (${kmh(c.vientoVelocidad)}): peina la ola`
          : c.entradaViento === "calma"
            ? "Sin viento"
            : `Viento suave (${kmh(c.vientoVelocidad)})`,
      contra: (c) =>
        c.entradaViento === "mar"
          ? `Viento de mar (${kmh(c.vientoVelocidad)}): deshace la ola`
          : `Viento de ${kmh(c.vientoVelocidad)}`,
      descarta: (c) =>
        c.entradaViento === "tierra"
          ? `Viento de tierra muy fuerte (${kmh(c.vientoVelocidad)}): cuesta remar`
          : `Viento de mar (${kmh(c.vientoVelocidad)}): deshace la ola`,
    },
  },
};

const frase = (perfil: Perfil, factor: string, clave: keyof Frases) =>
  POR_PERFIL[perfil][factor]?.[clave] ?? COMUNES[factor]?.[clave];

// Desde esta nota, la explicación empieza por lo que suma; por debajo, por lo que resta
export const NOTA_ALTA = 70;

// Las razones de una nota, de la más a la menos importante:
// - Si algo descarta la playa: lo que la descarta y lo que resta. Las razones a favor
//   confundirían.
// - Con nota alta: la razón a favor que más pesa, después todo lo que resta y después el resto
//   a favor. Un 97 no debe empezar por "Nubes", pero una advertencia ("cuidado con los
//   hinchables") tiene que caber siempre.
// - Con nota baja: primero lo que resta.
// Lo que resta, de más a menos (peso × lo que le falta para 1); lo que suma, por su peso.
export function generarRazones(
  perfil: Perfil,
  { nota, factores }: NotaPerfil,
  c: Condiciones,
): Razon[] {
  const descartan: (Razon & { peso: number })[] = [];
  const restan: (Razon & { resta: number })[] = [];
  const suman: (Razon & { peso: number })[] = [];
  for (const { nombre, valor, peso, lado } of factores) {
    if (valor === null) continue;
    if (valor === 0) {
      const texto = (frase(perfil, nombre, "descarta") ?? frase(perfil, nombre, "contra"))?.(
        c,
        lado,
      );
      if (texto) descartan.push({ tipo: "descarta", factor: nombre, texto, peso });
    } else if (valor < CONTRA) {
      const texto = frase(perfil, nombre, "contra")?.(c, lado);
      if (texto)
        restan.push({ tipo: "en_contra", factor: nombre, texto, resta: peso * (1 - valor) });
    } else if (valor >= FAVOR) {
      const texto = frase(perfil, nombre, "favor")?.(c, lado);
      if (texto) suman.push({ tipo: "a_favor", factor: nombre, texto, peso });
    }
  }
  const enContra = restan.toSorted((a, b) => b.resta - a.resta);
  const aFavor = suman.toSorted((a, b) => b.peso - a.peso);

  let orden: Razon[];
  if (descartan.length > 0) {
    orden = [...descartan.toSorted((a, b) => b.peso - a.peso), ...enContra];
  } else if (nota >= NOTA_ALTA) {
    orden = [...aFavor.slice(0, 1), ...enContra, ...aFavor.slice(1)];
  } else {
    orden = [...enContra, ...aFavor];
  }
  return orden.slice(0, MAX_RAZONES).map(({ tipo, factor, texto }) => ({ tipo, factor, texto }));
}
