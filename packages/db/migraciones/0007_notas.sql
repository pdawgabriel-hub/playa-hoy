CREATE TABLE "notas" (
	"playa_id" integer NOT NULL,
	"perfil" text NOT NULL,
	"hora" timestamp with time zone NOT NULL,
	"nota" smallint NOT NULL,
	"razones" text[] DEFAULT '{}'::text[] NOT NULL,
	"emitida_en" timestamp with time zone NOT NULL,
	CONSTRAINT "notas_playa_id_perfil_hora_pk" PRIMARY KEY("playa_id","perfil","hora"),
	CONSTRAINT "notas_perfil" CHECK ("notas"."perfil" IN ('familia', 'snorkel', 'sol', 'surf')),
	CONSTRAINT "notas_nota" CHECK ("notas"."nota" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "notas" ADD CONSTRAINT "notas_playa_id_playas_id_fk" FOREIGN KEY ("playa_id") REFERENCES "public"."playas"("id") ON DELETE cascade ON UPDATE no action;