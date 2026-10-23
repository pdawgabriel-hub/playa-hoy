ALTER TABLE "playas" ADD COLUMN "punto_consulta_id" integer;--> statement-breakpoint
ALTER TABLE "puntos_consulta" ADD COLUMN "celdas" text NOT NULL;--> statement-breakpoint
ALTER TABLE "playas" ADD CONSTRAINT "playas_punto_consulta_id_puntos_consulta_id_fk" FOREIGN KEY ("punto_consulta_id") REFERENCES "public"."puntos_consulta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playas_punto_consulta_idx" ON "playas" USING btree ("punto_consulta_id");--> statement-breakpoint
ALTER TABLE "puntos_consulta" ADD CONSTRAINT "puntos_consulta_celdas_unique" UNIQUE("celdas");