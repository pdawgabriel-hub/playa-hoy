CREATE TABLE "calidad_agua" (
	"playa_id" integer NOT NULL,
	"temporada" integer NOT NULL,
	"calificacion" text NOT NULL,
	CONSTRAINT "calidad_agua_playa_id_temporada_pk" PRIMARY KEY("playa_id","temporada"),
	CONSTRAINT "calidad_agua_calificacion" CHECK ("calidad_agua"."calificacion" IN ('excelente', 'buena', 'suficiente', 'insuficiente', 'sin_clasificar')),
	CONSTRAINT "calidad_agua_temporada" CHECK ("calidad_agua"."temporada" >= 2011)
);
--> statement-breakpoint
ALTER TABLE "calidad_agua" ADD CONSTRAINT "calidad_agua_playa_id_playas_id_fk" FOREIGN KEY ("playa_id") REFERENCES "public"."playas"("id") ON DELETE cascade ON UPDATE no action;