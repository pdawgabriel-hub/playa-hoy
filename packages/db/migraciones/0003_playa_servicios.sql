CREATE TABLE "playa_servicios" (
	"playa_id" integer PRIMARY KEY NOT NULL,
	"socorrista" boolean,
	"perros" boolean,
	"accesible" boolean,
	"aseos" boolean,
	"duchas" boolean,
	"fuente" text NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playa_servicios_fuente" CHECK ("playa_servicios"."fuente" IN ('osm', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD CONSTRAINT "playa_servicios_playa_id_playas_id_fk" FOREIGN KEY ("playa_id") REFERENCES "public"."playas"("id") ON DELETE cascade ON UPDATE no action;