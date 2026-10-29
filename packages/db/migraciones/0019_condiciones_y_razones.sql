CREATE TABLE "condiciones" (
	"playa_id" integer NOT NULL,
	"hora" timestamp with time zone NOT NULL,
	"ola_orilla" real,
	"ola_periodo" real,
	"entrada_viento" text,
	"claridad" real,
	"estado_agua" text,
	"temperatura_agua" real,
	"fuente_temperatura_agua" text,
	"bandera" text,
	"emitida_en" timestamp with time zone NOT NULL,
	CONSTRAINT "condiciones_playa_id_hora_pk" PRIMARY KEY("playa_id","hora"),
	CONSTRAINT "condiciones_entrada_viento" CHECK ("condiciones"."entrada_viento" IN ('mar', 'lado', 'tierra', 'calma')),
	CONSTRAINT "condiciones_claridad" CHECK ("condiciones"."claridad" BETWEEN 0 AND 1),
	CONSTRAINT "condiciones_estado_agua" CHECK ("condiciones"."estado_agua" IN ('cristalina', 'buena', 'turbia')),
	CONSTRAINT "condiciones_fuente_temperatura_agua" CHECK ("condiciones"."fuente_temperatura_agua" IN ('open_meteo', 'aemet')),
	CONSTRAINT "condiciones_bandera" CHECK ("condiciones"."bandera" IN ('verde', 'amarilla', 'roja')),
	CONSTRAINT "condiciones_no_negativos" CHECK ("condiciones"."ola_orilla" >= 0 AND "condiciones"."ola_periodo" >= 0)
);
--> statement-breakpoint
-- Corregido a mano: PostgreSQL no convierte text[] en jsonb por sí solo, y el valor por
-- defecto antiguo ('{}'::text[]) no vale para el tipo nuevo. La tabla estaba vacía.
ALTER TABLE "notas" ALTER COLUMN "razones" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notas" ALTER COLUMN "razones" SET DATA TYPE jsonb USING to_jsonb("razones");--> statement-breakpoint
ALTER TABLE "notas" ALTER COLUMN "razones" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "condiciones" ADD CONSTRAINT "condiciones_playa_id_playas_id_fk" FOREIGN KEY ("playa_id") REFERENCES "public"."playas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "condiciones_hora_idx" ON "condiciones" USING btree ("hora");