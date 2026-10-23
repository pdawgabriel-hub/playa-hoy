CREATE TABLE "costa" (
	"id" text PRIMARY KEY NOT NULL,
	"linea" geometry(LineString,4326) NOT NULL,
	"descargada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "costa_linea_idx" ON "costa" USING gist ("linea");