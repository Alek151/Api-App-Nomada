CREATE TABLE IF NOT EXISTS "travel_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "requester_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipient_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "introduction" varchar(500),
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "travel_connections_pair_uq" ON "travel_connections" USING btree ("requester_user_id", "recipient_user_id");
CREATE INDEX IF NOT EXISTS "travel_connections_recipient_idx" ON "travel_connections" USING btree ("recipient_user_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "travel_connections_requester_idx" ON "travel_connections" USING btree ("requester_user_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "travel_connections"("id") ON DELETE CASCADE,
  "sender_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" varchar(1000) NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "direct_messages_connection_created_idx" ON "direct_messages" USING btree ("connection_id", "created_at");

CREATE TABLE IF NOT EXISTS "profile_likes" (
  "profile_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "profile_likes_profile_user_id_user_id_pk" PRIMARY KEY("profile_user_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "profile_likes_profile_idx" ON "profile_likes" USING btree ("profile_user_id");
