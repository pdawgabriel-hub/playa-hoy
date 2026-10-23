CREATE TABLE "previsiones_aemet" (
	"playa_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"elaborada_en" timestamp with time zone NOT NULL,
	"temperatura_agua" real,
	"temperatura_maxima" real,
	"uv_maximo" real,
	CONSTRAINT "previsiones_aemet_playa_id_fecha_pk" PRIMARY KEY("playa_id","fecha"),
	CONSTRAINT "previsiones_aemet_uv" CHECK ("previsiones_aemet"."uv_maximo" >= 0)
);
--> statement-breakpoint
ALTER TABLE "previsiones_aemet" ADD CONSTRAINT "previsiones_aemet_playa_id_playas_id_fk" FOREIGN KEY ("playa_id") REFERENCES "public"."playas"("id") ON DELETE cascade ON UPDATE no action;