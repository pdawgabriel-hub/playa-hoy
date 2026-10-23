import { check, integer, pgTable, text } from "drizzle-orm/pg-core";

import { condicionSlug } from "./comun.ts";

// División que entiende la gente (Mar Menor, La Manga, Calblanque y Cabo de Palos…).
// Una zona puede abarcar varios municipios: la relación sale de las playas.
export const zonas = pgTable(
  "zonas",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombre: text().notNull(),
    slug: text().notNull().unique(),
  },
  (t) => [check("zonas_slug", condicionSlug(t.slug))],
);
