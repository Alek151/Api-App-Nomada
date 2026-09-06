-- Flujo editorial simplificado: un lugar guardado queda disponible para viajeros.
-- Los archivados se eliminan junto con sus sellos huérfanos, según la decisión operativa.
DELETE FROM stamps
WHERE destination_id IN (SELECT id FROM destinations WHERE content_status = 'archived');

DELETE FROM destinations
WHERE content_status = 'archived';

UPDATE destinations
SET content_status = 'published',
    is_active = true,
    updated_at = now()
WHERE content_status = 'draft' OR is_active = false;
