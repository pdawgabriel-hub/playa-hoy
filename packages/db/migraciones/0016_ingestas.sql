CREATE TABLE "ingestas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingestas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fuente" text NOT NULL,
	"empezada_en" timestamp with time zone NOT NULL,
	"terminada_en" timestamp with time zone NOT NULL,
	"estado" text NOT NULL,
	"filas" integer NOT NULL,
	"errores" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "ingestas_fuente" CHECK ("ingestas"."fuente" IN ('open_meteo', 'aemet')),
	CONSTRAINT "ingestas_estado" CHECK ("ingestas"."estado" IN ('ok', 'parcial', 'error')),
	CONSTRAINT "ingestas_filas" CHECK ("ingestas"."filas" >= 0)
);
--> statement-breakpoint
CREATE INDEX "ingestas_fuente_empezada_en_idx" ON "ingestas" USING btree ("fuente","empezada_en" DESC NULLS LAST);