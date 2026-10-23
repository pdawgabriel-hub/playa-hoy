CREATE INDEX "estaciones_ubicacion_idx" ON "estaciones" USING gist ("ubicacion");--> statement-breakpoint
CREATE INDEX "notas_ranking_idx" ON "notas" USING btree ("perfil","hora","nota" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "playas_ubicacion_idx" ON "playas" USING gist ("ubicacion");--> statement-breakpoint
CREATE INDEX "playas_ubicacion_geography_idx" ON "playas" USING gist (("ubicacion"::geography));--> statement-breakpoint
CREATE INDEX "playas_municipio_idx" ON "playas" USING btree ("municipio_id");--> statement-breakpoint
CREATE INDEX "playas_zona_idx" ON "playas" USING btree ("zona_id");--> statement-breakpoint
CREATE INDEX "previsiones_hora_idx" ON "previsiones" USING btree ("hora");--> statement-breakpoint
CREATE INDEX "previsiones_emitida_en_idx" ON "previsiones" USING btree ("emitida_en");--> statement-breakpoint
CREATE INDEX "puntos_consulta_ubicacion_idx" ON "puntos_consulta" USING gist ("ubicacion");