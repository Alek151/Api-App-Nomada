CREATE TABLE IF NOT EXISTS saved_destinations (
  destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection varchar(80) NOT NULL DEFAULT 'Guardados',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (destination_id, user_id)
);
CREATE INDEX IF NOT EXISTS saved_destinations_user_idx ON saved_destinations(user_id, collection, created_at DESC);
