ALTER TABLE "profiles" ADD COLUMN "registration_document_type" varchar(24);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "registration_document_hash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_registration_document_uq" ON "profiles" USING btree ("registration_document_hash");