CREATE TABLE "municipios" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "municipios_slug_unique" UNIQUE("slug"),
	CONSTRAINT "municipios_id_ine" CHECK ("municipios"."id" ~ '^[0-9]{5}$'),
	CONSTRAINT "municipios_slug" CHECK ("municipios"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "zonas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zonas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "zonas_slug_unique" UNIQUE("slug"),
	CONSTRAINT "zonas_slug" CHECK ("zonas"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
