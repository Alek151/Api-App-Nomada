-- El mapa público y Administración usan la misma tabla: destinations.
-- Este índice acelera el filtro por país y el orden al recorrer el catálogo.
CREATE INDEX IF NOT EXISTS destinations_admin_catalog_idx
  ON destinations (country_code, name);
