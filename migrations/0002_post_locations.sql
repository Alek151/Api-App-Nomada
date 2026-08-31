ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "location_label" varchar(160);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "latitude" double precision;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "longitude" double precision;
