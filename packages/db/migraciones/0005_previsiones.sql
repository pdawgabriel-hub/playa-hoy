CREATE TABLE "previsiones" (
	"punto_id" integer NOT NULL,
	"emitida_en" timestamp with time zone NOT NULL,
	"hora" timestamp with time zone NOT NULL,
	"viento_velocidad" real,
	"viento_direccion" real,
	"viento_racha" real,
	"temperatura_aire" real,
	"nubosidad" real,
	"ola_altura" real,
	"ola_direccion" real,
	"ola_periodo" real,
	"temperatura_agua" real,
	CONSTRAINT "previsiones_punto_id_emitida_en_hora_pk" PRIMARY KEY("punto_id","emitida_en","hora"),
	CONSTRAINT "previsiones_viento_direccion" CHECK ("previsiones"."viento_direccion" BETWEEN 0 AND 360),
	CONSTRAINT "previsiones_ola_direccion" CHECK ("previsiones"."ola_direccion" BETWEEN 0 AND 360),
	CONSTRAINT "previsiones_nubosidad" CHECK ("previsiones"."nubosidad" BETWEEN 0 AND 100),
	CONSTRAINT "previsiones_no_negativos" CHECK ("previsiones"."viento_velocidad" >= 0 AND "previsiones"."viento_racha" >= 0 AND "previsiones"."ola_altura" >= 0 AND "previsiones"."ola_periodo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "puntos_consulta" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "puntos_consulta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ubicacion" geometry(Point,4326) NOT NULL,
	CONSTRAINT "puntos_consulta_ubicacion_unique" UNIQUE("ubicacion")
);
--> statement-breakpoint
ALTER TABLE "previsiones" ADD CONSTRAINT "previsiones_punto_id_puntos_consulta_id_fk" FOREIGN KEY ("punto_id") REFERENCES "public"."puntos_consulta"("id") ON DELETE cascade ON UPDATE no action;