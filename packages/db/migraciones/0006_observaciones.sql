CREATE TABLE "estaciones" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"ubicacion" geometry(Point,4326) NOT NULL,
	"altitud" real,
	"fuente" text NOT NULL,
	CONSTRAINT "estaciones_fuente" CHECK ("estaciones"."fuente" IN ('aemet', 'puertos_estado'))
);
--> statement-breakpoint
CREATE TABLE "observaciones" (
	"estacion_id" text NOT NULL,
	"hora" timestamp with time zone NOT NULL,
	"viento_velocidad" real,
	"viento_direccion" real,
	"viento_racha" real,
	"temperatura_aire" real,
	"ola_altura" real,
	"ola_direccion" real,
	"ola_periodo" real,
	"temperatura_agua" real,
	CONSTRAINT "observaciones_estacion_id_hora_pk" PRIMARY KEY("estacion_id","hora"),
	CONSTRAINT "observaciones_viento_direccion" CHECK ("observaciones"."viento_direccion" BETWEEN 0 AND 360),
	CONSTRAINT "observaciones_ola_direccion" CHECK ("observaciones"."ola_direccion" BETWEEN 0 AND 360),
	CONSTRAINT "observaciones_no_negativos" CHECK ("observaciones"."viento_velocidad" >= 0 AND "observaciones"."viento_racha" >= 0 AND "observaciones"."ola_altura" >= 0 AND "observaciones"."ola_periodo" >= 0)
);
--> statement-breakpoint
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_estacion_id_estaciones_id_fk" FOREIGN KEY ("estacion_id") REFERENCES "public"."estaciones"("id") ON DELETE cascade ON UPDATE no action;