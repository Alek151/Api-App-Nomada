-- Seguimiento operativo de los viajeros interesados desde el portal administrativo.
ALTER TABLE traveler_interests ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE traveler_interests ADD COLUMN IF NOT EXISTS contacted_at timestamptz;
