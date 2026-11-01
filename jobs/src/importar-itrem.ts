// Añade a las playas los datos de ITREM (accesible, nudista, suelo, ocupación) según la
// tabla de correspondencias revisada: pnpm --filter @playa-hoy/jobs importar:itrem
// Antes hay que importar las playas del censo.
import { crearDb, esquema, isNotNull } from "@playa-hoy/db";
import { esquemaBaseDatos, leerEntorno } from "@playa-hoy/shared";

import correspondencias from "../datos/correspondencias-itrem.json" with { type: "json" };
import itrem from "../datos/itrem-playas.json" with { type: "json" };
import { importarServiciosItrem, prepararServiciosItrem } from "./servicios-itrem.ts";

const { DATABASE_URL } = leerEntorno(esquemaBaseDatos, process.env);
const { db, cerrar } = crearDb(DATABASE_URL);

try {
  const playas = await db
    .select({ id: esquema.playas.id, codigoCenso: esquema.playas.codigoCenso })
    .from(esquema.playas)
    .where(isNotNull(esquema.playas.codigoCenso));
  const ids = new Map(playas.map((p) => [p.codigoCenso ?? "", p.id]));

  const servicios = prepararServiciosItrem(itrem, correspondencias, ids);
  const { nuevas, actualizadas } = await importarServiciosItrem(db, servicios);
  console.log(
    `ITREM: servicios de ${servicios.length} playas (${nuevas} nuevas, ${actualizadas} actualizadas)`,
  );
} finally {
  await cerrar();
}
