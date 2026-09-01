-- Conserva los IDs históricos que ya podían tener visitas/sellos y oculta los
-- tres duplicados creados por el catálogo inicial con slugs más cortos.
UPDATE "destinations" AS historic
SET
  "category" = seeded."category",
  "description" = seeded."description",
  "latitude" = seeded."latitude",
  "longitude" = seeded."longitude",
  "activities" = seeded."activities",
  "average_cost_min" = seeded."average_cost_min",
  "average_cost_max" = seeded."average_cost_max",
  "cost_currency" = seeded."cost_currency",
  "content_status" = 'published',
  "updated_at" = now()
FROM "destinations" AS seeded
WHERE (historic."slug", seeded."slug") IN (
  ('antigua-guatemala', 'antigua'),
  ('lago-atitlan', 'atitlan'),
  ('semuc-champey', 'semuc')
);

UPDATE "destinations"
SET "is_active" = false, "content_status" = 'archived', "updated_at" = now()
WHERE "slug" IN ('antigua', 'atitlan', 'semuc');
