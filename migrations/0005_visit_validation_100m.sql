-- La validación de visitas de Nómada es uniforme para todo el catálogo.
-- El Worker también aplica este límite para no depender únicamente del cliente.
ALTER TABLE "destinations"
  ALTER COLUMN "validation_radius_meters" SET DEFAULT 100;

UPDATE "destinations"
SET "validation_radius_meters" = 100,
    "updated_at" = now()
WHERE "validation_radius_meters" IS DISTINCT FROM 100;
