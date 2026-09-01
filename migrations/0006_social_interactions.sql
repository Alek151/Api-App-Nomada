ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "comments"("id") ON DELETE CASCADE;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "like_count" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "comments_parent_idx" ON "comments" ("parent_id");

CREATE TABLE IF NOT EXISTS "comment_likes" (
  "comment_id" uuid NOT NULL REFERENCES "comments"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("comment_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "saved_posts" (
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("post_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "saved_posts_user_idx" ON "saved_posts" ("user_id");
