import { sql } from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";

// Slug para URLs: minúsculas, números y guiones simples ("san-pedro-del-pinatar").
export const condicionSlug = (columna: AnyPgColumn) => sql`${columna} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`;
