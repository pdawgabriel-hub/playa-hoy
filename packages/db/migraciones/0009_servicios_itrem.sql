ALTER TABLE "playa_servicios" DROP CONSTRAINT "playa_servicios_fuente";--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD COLUMN "nudista" boolean;--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD COLUMN "suelo" text;--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD COLUMN "ocupacion" text;--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD COLUMN "fuentes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD CONSTRAINT "playa_servicios_fuentes" CHECK ("playa_servicios"."fuentes" <@ ARRAY['itrem', 'osm', 'manual']);--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD CONSTRAINT "playa_servicios_suelo" CHECK ("playa_servicios"."suelo" IN ('arena_fina', 'arena', 'arena_y_grava', 'grava', 'bolos', 'roca'));--> statement-breakpoint
ALTER TABLE "playa_servicios" ADD CONSTRAINT "playa_servicios_ocupacion" CHECK ("playa_servicios"."ocupacion" IN ('baja', 'media', 'alta'));