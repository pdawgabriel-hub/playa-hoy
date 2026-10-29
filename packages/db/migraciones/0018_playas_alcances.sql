ALTER TABLE "playas" ADD COLUMN "alcances" real[];--> statement-breakpoint
ALTER TABLE "playas" ADD CONSTRAINT "playas_alcances" CHECK (cardinality("playas"."alcances") = 37);