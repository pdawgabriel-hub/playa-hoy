import { sql } from "drizzle-orm";
import { check, pgTable, text } from "drizzle-orm/pg-core";

import { condicionSlug } from "./comun.ts";

// División administrativa. La clave es el código INE, que también llevan los códigos
// del censo de aguas de baño (ES620M003… es Águilas, 30003).
export const municipios = pgTable(
  "municipios",
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    slug: text().notNull().unique(),
  },
  (t) => [
    check("municipios_id_ine", sql`${t.id} ~ '^[0-9]{5}$'`),
    check("municipios_slug", condicionSlug(t.slug)),
  ],
);
