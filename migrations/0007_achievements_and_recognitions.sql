ALTER TABLE "badges" ADD COLUMN IF NOT EXISTS "category" varchar(60) NOT NULL DEFAULT 'exploración';
ALTER TABLE "badges" ADD COLUMN IF NOT EXISTS "points" integer NOT NULL DEFAULT 50;
ALTER TABLE "badges" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "recognitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "code" varchar(40) NOT NULL UNIQUE,
  "title" varchar(140) NOT NULL, "description" text, "artwork_key" text,
  "category" varchar(60) NOT NULL DEFAULT 'comunidad', "partner_name" varchar(140),
  "benefit_text" varchar(240), "points" integer NOT NULL DEFAULT 100,
  "is_active" boolean NOT NULL DEFAULT true, "requirement" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "user_recognitions" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recognition_id" uuid NOT NULL REFERENCES "recognitions"("id") ON DELETE CASCADE,
  "earned_at" timestamptz NOT NULL DEFAULT now(), "notes" text,
  PRIMARY KEY ("user_id", "recognition_id")
);

INSERT INTO "badges" ("code", "name", "description", "category", "points", "requirement") VALUES
('PRIMEROS-PASOS', 'Primeros pasos', 'Completa tu primera visita verificada.', 'exploración', 50, '{"verifiedVisits":1}'),
('EXPLORADOR-LAGOS', 'Explorador de lagos', 'Conoce destinos de agua y lagos de Guatemala.', 'naturaleza', 100, '{"category":"Agua","verifiedVisits":3}'),
('RUTA-MAYA', 'Ruta Maya', 'Colecciona sellos de cultura e historia.', 'cultura', 150, '{"category":"Cultura maya","verifiedVisits":3}'),
('GUARDIAN-CONSCIENTE', 'Guardián consciente', 'Reconocimiento por explorar con respeto.', 'comunidad', 100, '{"verifiedVisits":5}'),
('SIETE-DIAS', '7 días de aventura', 'Mantén viva tu bitácora de viajes.', 'aventura', 100, '{"verifiedVisits":7}')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "recognitions" ("code", "title", "description", "category", "points", "requirement") VALUES
('VIAJERO-CONFIABLE', 'Viajero confiable', 'Tus visitas verificadas inspiran confianza en la comunidad.', 'comunidad', 100, '{"verifiedVisits":5}'),
('COLECCIONISTA-SELLLOS', 'Coleccionista de sellos', 'Construye un pasaporte lleno de historias reales.', 'exploración', 150, '{"stamps":10}')
ON CONFLICT ("code") DO NOTHING;
