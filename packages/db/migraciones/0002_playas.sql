CREATE TABLE "playas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "playas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"municipio_id" text NOT NULL,
	"zona_id" integer,
	"ubicacion" geometry(Point,4326) NOT NULL,
	"mira" real,
	"abrigo" real,
	"laguna" boolean DEFAULT false NOT NULL,
	"codigo_censo" text,
	"codigo_aemet" text,
	"osm_id" text,
	CONSTRAINT "playas_slug_unique" UNIQUE("slug"),
	CONSTRAINT "playas_codigo_censo_unique" UNIQUE("codigo_censo"),
	CONSTRAINT "playas_codigo_aemet_unique" UNIQUE("codigo_aemet"),
	CONSTRAINT "playas_osm_id_unique" UNIQUE("osm_id"),
	CONSTRAINT "playas_slug" CHECK ("playas"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "playas_mira" CHECK ("playas"."mira" >= 0 AND "playas"."mira" < 360),
	CONSTRAINT "playas_abrigo" CHECK ("playas"."abrigo" BETWEEN 0 AND 1),
	CONSTRAINT "playas_origen" CHECK ("playas"."codigo_censo" IS NOT NULL OR "playas"."osm_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "playas" ADD CONSTRAINT "playas_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playas" ADD CONSTRAINT "playas_zona_id_zonas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas"("id") ON DELETE no action ON UPDATE no action;