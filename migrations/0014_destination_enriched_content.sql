-- Ficha editorial enriquecida para cada punto de visita en Nómada.
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS official_name varchar(200);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS municipality varchar(100);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS subcategory varchar(100);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS short_description varchar(320);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS history text;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS historical_period varchar(160);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS approximate_date varchar(160);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS unesco_status boolean NOT NULL DEFAULT false;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS unesco_type varchar(40);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS visit_duration_minutes integer;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS accessibility jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS visitor_info jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS nomada_recommendations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS nomada_certified_at timestamptz;
