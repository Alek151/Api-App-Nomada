-- Fuente mínima trazable para el catálogo heredado. Los datos específicos
-- continúan siendo enriquecidos por Nómada desde Administración.
UPDATE destinations
SET coordinates_source = COALESCE(coordinates_source, metadata->>'coordinatesSource', 'OpenStreetMap / Nómada editorial'),
    history_source = COALESCE(history_source, metadata->>'historySource', metadata->>'sourceName', source_url, 'Nómada editorial'),
    updated_at = now()
WHERE coordinates_source IS NULL OR history_source IS NULL;
