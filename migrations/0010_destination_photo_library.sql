-- Procedencia editorial de las fotografías públicas de cada lugar.
-- Las nuevas cargas administrativas se identifican como parte de Nómada Fotos Library.
ALTER TABLE "destination_photos"
  ADD COLUMN IF NOT EXISTS "source" varchar(24) NOT NULL DEFAULT 'nomada_library';
ALTER TABLE "destination_photos"
  ADD COLUMN IF NOT EXISTS "credit" varchar(140);
